import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/*
 * End-to-end checks of the real back end against Postgres, using the restricted app role:
 * sign-up, sign-in and lockout, club set-up, students, registers and club isolation.
 */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://junbi_app:junbi_app@localhost:5432/junbi_test";
process.env.DATABASE_URL = APP_URL;

const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
const appSql = postgres(APP_URL, { max: 1 });

// Imported after DATABASE_URL is set; db() connects lazily on first use.
const accounts = await import("@/data/accounts");
const studentsEdit = await import("@/data/student-edit");
const students = await import("@/data/students");
const classes = await import("@/data/classes");
const club = await import("@/data/club");
const flows = await import("@/data/email-flows");
const { hashPassword, verifyPassword, passwordProblem } = await import("@/auth/password");
type Actor = import("@/auth/permissions").Actor;

const owner = (userId: string, clubId: string): Actor => ({ userId, clubId, role: "owner", sites: "all" });

async function signUp(email: string, clubName: string) {
  const r = await accounts.createClubAccount({ clubName, name: "Sam Owner", email, password: "a long enough phrase", plan: "club", founding: true, terms: true });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return owner(r.value.userId, r.value.clubId);
}

let a: Actor;
let b: Actor;

beforeAll(async () => {
  await adminSql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await adminSql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
    END IF; END $$;`);
  await migrate(drizzle(adminSql), { migrationsFolder: "drizzle" });
  a = await signUp("owner-a@example.test", "Club A Taekwondo");
  b = await signUp("owner-b@example.test", "Club B Taekwondo");
});

afterAll(async () => {
  await adminSql.end();
  await appSql.end();
});

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
  it("rejects short and obvious passwords", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("password12345")).toMatch(/easy to guess/);
    expect(passwordProblem("a long enough phrase")).toBeNull();
  });
});

describe("sign-up", () => {
  it("creates the club with a trial and the person as owner", async () => {
    const rows = await adminSql`select c.name, c.founding, c.trial_ends_on, cs.role, u.password_hash
      from clubs c join club_staff cs on cs.club_id = c.id join users u on u.id = cs.user_id where c.id = ${a.clubId}`;
    expect(rows[0]).toMatchObject({ name: "Club A Taekwondo", founding: true, role: "owner" });
    expect(rows[0].trial_ends_on).not.toBeNull();
    expect(String(rows[0].password_hash)).toMatch(/^scrypt\$/);
  });
  it("refuses a second account with the same email, any capitalisation", async () => {
    const r = await accounts.createClubAccount({ clubName: "Copy", name: "Xavier", email: "OWNER-A@example.test", password: "a long enough phrase", plan: "club", founding: false, terms: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.email).toMatch(/already an account/);
    const [{ n }] = await adminSql`select count(*)::int as n from clubs where name = 'Copy'`;
    expect(n).toBe(0);
  });
  it("needs the terms ticked and a decent password", async () => {
    const r = await accounts.createClubAccount({ clubName: "Club C", name: "Y", email: "c@example.test", password: "short", plan: "club", founding: false, terms: false });
    expect(r.ok).toBe(false);
    expect(!r.ok && (r.errors.terms || r.errors.password)).toBeTruthy();
  });
});

describe("sign-in", () => {
  it("accepts the right password and gives one vague error otherwise", async () => {
    expect((await accounts.checkLogin("Owner-A@example.test", "a long enough phrase")).ok).toBe(true);
    const wrong = await accounts.checkLogin("owner-a@example.test", "not the password");
    const nobody = await accounts.checkLogin("nobody@example.test", "not the password");
    expect(!wrong.ok && wrong.errors.form).toBe(!nobody.ok && nobody.errors.form);
  });
  it("locks an email out after repeated failures", async () => {
    for (let i = 0; i < 8; i++) await accounts.checkLogin("owner-b@example.test", "guess " + i);
    const r = await accounts.checkLogin("owner-b@example.test", "a long enough phrase");
    expect(!r.ok && r.errors.form).toMatch(/Too many attempts/);
    await adminSql`delete from auth_failures`;
  });
});

describe("the app role and sign-in data", () => {
  it("cannot read sessions, failures or password hashes' table directly, nor create users", async () => {
    await expect(appSql`select * from auth_sessions`).rejects.toThrow(/permission denied/);
    await expect(appSql`select * from auth_failures`).rejects.toThrow(/permission denied/);
    await expect(appSql`insert into users (email, name) values ('x@example.test', 'X')`).rejects.toThrow(/permission denied/);
  });
  it("can only use sessions through the functions", async () => {
    await appSql`select auth_session_create('hash1', ${a.userId}::uuid, now() + interval '1 day')`;
    await appSql`select auth_session_create('hash2', ${a.userId}::uuid, now() - interval '1 minute')`;
    expect((await appSql`select * from auth_session_user('hash1')`)[0].user_id).toBe(a.userId);
    expect(await appSql`select * from auth_session_user('hash2')`).toHaveLength(0);
    await appSql`select auth_session_delete('hash1')`;
    expect(await appSql`select * from auth_session_user('hash1')`).toHaveLength(0);
  });
});

describe("club set-up", () => {
  it("sets up several arts with their own belt systems, first site, in the order picked", async () => {
    const r = await accounts.completeSetup(a, { disciplines: ["taekwondo", "kickboxing", "mma"], siteName: "Southport", siteAddress: "", syllabus: { taekwondo: "wt" } });
    expect(r.ok).toBe(true);
    const o = await club.getClubOverview(a);
    expect(o.activeArts).toEqual(["taekwondo", "kickboxing", "mma"]);
    const counts = await adminSql`select discipline, count(*)::int as n from grades where club_id = ${a.clubId} group by discipline`;
    expect(Object.fromEntries(counts.map((c) => [c.discipline, c.n]))).toEqual({ taekwondo: 14, kickboxing: 10 });
    expect(o.sites.map((s) => s.name)).toEqual(["Southport"]);
    expect(o.club.onboardedAt).not.toBeNull();
    const [{ n }] = await adminSql`select count(*)::int as n from grades where club_id = ${a.clubId} and discipline = 'taekwondo'`;
    expect(n).toBe(14);
  });
  it("requires at least one art", async () => {
    const r = await accounts.completeSetup(b, { disciplines: [], siteName: "Preston" });
    expect(!r.ok && r.errors.disciplines).toMatch(/at least one/);
  });
  it("gives Founding Clubs 30 days, others 14, and allows one 14-day extension", async () => {
    const days = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`)) / 86_400_000);
    expect(days((await club.getClubOverview(a)).club.trialEndsOn!)).toBe(30);
    const r = await accounts.createClubAccount({ clubName: "Club D", name: "Dee Owner", email: "d@example.test", password: "a long enough phrase", plan: "starter", founding: false, terms: true });
    const d = owner(r.ok ? r.value.userId : "", r.ok ? r.value.clubId : "");
    expect(days((await club.getClubOverview(d)).club.trialEndsOn!)).toBe(14);
    const ext = await club.extendTrial(d);
    expect(ext.ok && days(ext.value.trialEndsOn)).toBe(28);
    expect((await club.extendTrial(d)).ok).toBe(false);
    await expect(club.extendTrial({ ...d, role: "admin" })).rejects.toThrow(/Not allowed/);
  });
  it("lets the owner switch between Starter, Club and Academy, and nobody else", async () => {
    expect((await club.setPlan(a, "starter")).ok).toBe(true);
    expect((await club.getClubOverview(a)).club.plan).toBe("starter");
    expect((await club.setPlan(a, "association")).ok).toBe(false);
    await expect(club.setPlan({ ...a, role: "admin" }, "club")).rejects.toThrow(/Not allowed/);
    await club.setPlan(a, "club");
  });
  it("only lets the owner do it", async () => {
    await expect(accounts.completeSetup({ ...b, role: "instructor" }, { disciplines: ["taekwondo"], siteName: "X" })).rejects.toThrow(/Not allowed/);
  });
});

describe("students, classes and registers", () => {
  let studentId: string;
  let classId: string;

  it("adds a student with a family contact and starting belt", async () => {
    const opts = await studentsEdit.studentFormOptions(a);
    const r = await studentsEdit.createStudent(a, {
      firstName: "Ella", lastName: "Hughes", dateOfBirth: "2015-04-02", siteId: opts.sites[0].id, status: "active",
      medicalNotes: "Asthma pump in bag", firstAidConsent: true, photoConsent: false,
      startingGradeId: opts.grades[2].id, guardianFirstName: "Kate", guardianLastName: "Hughes", guardianEmail: "kate@example.test", relationship: "parent",
    });
    expect(r.ok).toBe(true);
    studentId = r.ok ? r.value.id : "";
    const list = await students.listStudents(a);
    expect(list).toHaveLength(1);
    expect(list[0].grades.map((g) => g.name)).toEqual(["8th Kup"]);
  });

  it("records a belt in a second art and shows both", async () => {
    const opts = await studentsEdit.studentFormOptions(a);
    const orange = opts.grades.find((g) => g.discipline === "kickboxing" && g.name === "Orange belt")!;
    const today = new Date().toISOString().slice(0, 10);
    expect((await studentsEdit.recordBelt(a, studentId, { gradeId: orange.id, gradedOn: today })).ok).toBe(true);
    expect((await studentsEdit.recordBelt(a, studentId, { gradeId: orange.id, gradedOn: "2999-01-01" })).ok).toBe(false);
    await expect(studentsEdit.recordBelt({ ...a, role: "assistant" }, studentId, { gradeId: orange.id, gradedOn: today })).rejects.toThrow(/Not allowed/);
    const list = await students.listStudents(a);
    expect(list[0].grades.map((g) => g.name)).toEqual(["8th Kup", "Orange belt"]);
    const profile = await students.getStudentProfile(a, studentId);
    expect(profile?.belts.map((b) => [b.discipline, b.current.grade.name, b.next?.name])).toEqual([
      ["taekwondo", "8th Kup", "7th Kup"],
      ["kickboxing", "Orange belt", "Green belt"],
    ]);
  });

  it("turning an art on loads its belts, and turning it off keeps them", async () => {
    expect((await club.setArt(a, "judo", true)).ok).toBe(true);
    const [{ n }] = await adminSql`select count(*)::int as n from grades where club_id = ${a.clubId} and discipline = 'judo'`;
    expect(n).toBe(9);
    expect((await club.setArt(a, "judo", false)).ok).toBe(true);
    expect((await club.getClubOverview(a)).activeArts).not.toContain("judo");
    const [{ m }] = await adminSql`select count(*)::int as m from grades where club_id = ${a.clubId} and discipline = 'judo'`;
    expect(m).toBe(9);
  });

  it("needs a contact for a brand new family", async () => {
    const opts = await studentsEdit.studentFormOptions(a);
    const r = await studentsEdit.createStudent(a, { firstName: "No", lastName: "Contact", siteId: opts.sites[0].id, status: "trial", firstAidConsent: false, photoConsent: false, relationship: "parent" });
    expect(!r.ok && r.errors.guardianFirstName).toBeTruthy();
  });

  it("adds a class and takes a register", async () => {
    const o = await club.getClubOverview(a);
    const date = "2026-10-05"; // a Monday
    const r = await classes.createClass(a, { name: "Juniors", siteId: o.sites[0].id, discipline: "taekwondo", weekday: "1", startsAt: "17:45", durationMinutes: "60", capacity: "" });
    expect(r.ok).toBe(true);
    classId = r.ok ? r.value.id : "";
    await classes.setAttendance(a, classId, date, studentId, true);
    await classes.setAttendance(a, classId, date, studentId, true); // double tap is harmless
    let reg = await classes.getRegister(a, classId, date);
    expect(reg.presentCount).toBe(1);
    expect((await classes.classesOn(a, date))[0].present).toBe(1);
    await classes.setAttendance(a, classId, date, studentId, false);
    reg = await classes.getRegister(a, classId, date);
    expect(reg.presentCount).toBe(0);
  });

  it("won't let a class use an art the club hasn't switched on", async () => {
    const o = await club.getClubOverview(a);
    const r = await classes.createClass(a, { name: "Judo", siteId: o.sites[0].id, discipline: "judo", weekday: "2", startsAt: "18:00", durationMinutes: "60", capacity: "" });
    expect(!r.ok && r.errors.discipline).toBeTruthy();
  });

  it("keeps clubs apart: club B can't see or touch club A's students or classes", async () => {
    await accounts.completeSetup(b, { disciplines: ["taekwondo"], siteName: "Preston", syllabus: { taekwondo: "itf" } });
    expect(await students.listStudents(b)).toHaveLength(0);
    expect(await students.getStudentProfile(b, studentId)).toBeNull();
    await expect(classes.getRegister(b, classId, "2026-10-05")).rejects.toThrow(/Not allowed/);
    await expect(classes.setAttendance(b, classId, "2026-10-05", studentId, true)).rejects.toThrow(/Not allowed/);
    const bSite = (await club.getClubOverview(b)).sites[0].id;
    const bad = await studentsEdit.updateStudent(b, studentId, { firstName: "X", lastName: "Y", siteId: bSite, status: "active", firstAidConsent: false, photoConsent: false }).catch((e) => e);
    expect(String(bad)).toMatch(/Not allowed/);
  });

  it("stops an assistant adding students", async () => {
    await expect(studentsEdit.createStudent({ ...a, role: "assistant" }, {} as never)).rejects.toThrow(/Not allowed/);
  });
});

/** Emails aren't sent in tests (no RESEND_API_KEY); they're printed. This grabs the link from the last one. */
async function captureLink(fn: () => Promise<unknown>, path: string) {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  await fn();
  const out = spy.mock.calls.map((c) => String(c[0])).join("\n");
  spy.mockRestore();
  const m = out.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  return m?.[1] ?? null;
}

describe("password reset", () => {
  it("emails a link only for real accounts, and the link sets a new password once", async () => {
    expect(await captureLink(() => flows.requestPasswordReset("nobody@example.test"), "/reset-password")).toBeNull();
    const token = await captureLink(() => flows.requestPasswordReset("Owner-B@example.test"), "/reset-password");
    expect(token).toBeTruthy();
    expect(await flows.resetLinkValid(token)).toBe(true);
    expect((await flows.resetPassword(token, "short")).ok).toBe(false);
    expect((await flows.resetPassword(token, "a brand new phrase")).ok).toBe(true);
    expect(await flows.resetLinkValid(token)).toBe(false);
    expect((await flows.resetPassword(token, "another new phrase")).ok).toBe(false);
    expect((await accounts.checkLogin("owner-b@example.test", "a brand new phrase")).ok).toBe(true);
    expect((await accounts.checkLogin("owner-b@example.test", "a long enough phrase")).ok).toBe(false);
    await adminSql`delete from auth_failures`;
  });
  it("can't read reset links or the email log directly", async () => {
    await expect(appSql`select * from password_resets`).rejects.toThrow(/permission denied/);
    await expect(appSql`select * from email_log`).rejects.toThrow(/permission denied/);
  });
});

describe("staff invites", () => {
  it("invites a new instructor for one site, who sets up their login and joins", async () => {
    const site = (await club.getClubOverview(a)).sites[0];
    const token = await captureLink(async () => {
      const r = await flows.inviteStaff(a, { email: "Coach.New@example.test", role: "instructor", siteIds: [site.id] });
      expect(r.ok).toBe(true);
    }, "/invite");
    expect(token).toBeTruthy();
    expect((await flows.listPendingInvites(a)).map((i) => i.email)).toEqual(["coach.new@example.test"]);
    const inv = await flows.lookupInvite(token);
    expect(inv).toMatchObject({ clubName: "Club A Taekwondo", email: "coach.new@example.test", role: "instructor", userExists: false });
    const r = await flows.acceptInviteAsNewUser(token, "Casey Coach", "spinning back kick");
    expect(r.ok).toBe(true);
    const [m] = await appSql`select * from staff_memberships_for(${r.ok ? r.value.userId : ""}::uuid)`;
    expect(m).toMatchObject({ club_id: a.clubId, role: "instructor", all_sites: false });
    expect(m.site_ids).toEqual([site.id]);
    expect(await flows.lookupInvite(token)).toBeNull();
    expect((await flows.listPendingInvites(a)).length).toBe(0);
  });

  it("lets someone who already has a login accept by signing in", async () => {
    const token = await captureLink(() => flows.inviteStaff(a, { email: "owner-b@example.test", role: "admin" }), "/invite");
    expect((await flows.lookupInvite(token))?.userExists).toBe(true);
    expect((await flows.acceptInviteAsNewUser(token, "Sneaky", "some password here")).ok).toBe(false);
    expect((await flows.acceptInviteAsExistingUser(token, "wrong password here")).ok).toBe(false);
    expect((await flows.acceptInviteAsExistingUser(token, "a brand new phrase")).ok).toBe(true);
    await adminSql`delete from auth_failures`;
  });

  it("checks who can invite and remove", async () => {
    await expect(flows.inviteStaff({ ...a, role: "instructor" }, { email: "x@example.test", role: "assistant" })).rejects.toThrow(/Not allowed/);
    const r = await flows.inviteStaff({ ...a, role: "admin" }, { email: "x@example.test", role: "admin" });
    expect(!r.ok && r.errors.role).toMatch(/Only the owner/);
    const dup = await flows.inviteStaff(a, { email: "coach.new@example.test", role: "assistant", siteIds: [(await club.getClubOverview(a)).sites[0].id] });
    expect(!dup.ok && dup.errors.email).toMatch(/already on your staff/);
    const staff = (await club.getClubOverview(a)).staff;
    const ownerRow = staff.find((x) => x.role === "owner")!;
    expect((await flows.removeStaff(a, ownerRow.id)).ok).toBe(false);
    const coach = staff.find((x) => x.email === "coach.new@example.test")!;
    expect((await flows.removeStaff(a, coach.id)).ok).toBe(true);
  });

  it("an invite for one club can't be used to join another", async () => {
    const bSite = (await club.getClubOverview(b)).sites[0].id;
    const token = await captureLink(() => flows.inviteStaff(b, { email: "b-coach@example.test", role: "instructor", siteIds: [bSite] }), "/invite");
    // Club A can't see or cancel club B's invites.
    expect((await flows.listPendingInvites(a)).find((i) => i.email === "b-coach@example.test")).toBeUndefined();
    expect((await flows.lookupInvite(token))?.clubName).toBe("Club B Taekwondo");
  });
});

describe("trial reminders", () => {
  it("emails owners 7, 3 and 1 days before the trial ends, once each", async () => {
    await adminSql`update clubs set trial_ends_on = (now() at time zone 'Europe/London')::date + 7 where id = ${a.clubId}`;
    await adminSql`update clubs set trial_ends_on = (now() at time zone 'Europe/London')::date + 5 where id <> ${a.clubId}`;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const first = await flows.sendTrialReminders();
    const second = await flows.sendTrialReminders();
    spy.mockRestore();
    expect(first).toEqual({ due: 1, sent: 1 });
    expect(second).toEqual({ due: 1, sent: 0 });
    const [{ n }] = await adminSql`select count(*)::int as n from email_log where template = 'trial-7' and club_id = ${a.clubId}`;
    expect(n).toBe(1);
  });
});
