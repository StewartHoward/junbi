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
const importer = await import("@/data/student-import");
const join = await import("@/data/join");
const msgs = await import("@/data/messages");
const pay = await import("@/data/payments");
const leads = await import("@/data/leads");
const ownStripe = await import("@/data/stripe-own");
const dash = await import("@/data/dashboard");
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
  it("gives every club a 7-day trial, Founding Clubs included", async () => {
    const days = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`)) / 86_400_000);
    expect(days((await club.getClubOverview(a)).club.trialEndsOn!)).toBe(7);
    const r = await accounts.createClubAccount({ clubName: "Club D", name: "Dee Owner", email: "d@example.test", password: "a long enough phrase", plan: "starter", founding: false, terms: true });
    const d = owner(r.ok ? r.value.userId : "", r.ok ? r.value.clubId : "");
    expect(days((await club.getClubOverview(d)).club.trialEndsOn!)).toBe(7);
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
  it("emails owners 3 and 1 days before the trial ends, once each", async () => {
    await adminSql`update clubs set trial_ends_on = (now() at time zone 'Europe/London')::date + 3 where id = ${a.clubId}`;
    await adminSql`update clubs set trial_ends_on = (now() at time zone 'Europe/London')::date + 5 where id <> ${a.clubId}`;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const first = await flows.sendTrialReminders();
    const second = await flows.sendTrialReminders();
    spy.mockRestore();
    expect(first).toEqual({ due: 1, sent: 1 });
    expect(second).toEqual({ due: 1, sent: 0 });
    const [{ n }] = await adminSql`select count(*)::int as n from email_log where template = 'trial-3' and club_id = ${a.clubId}`;
    expect(n).toBe(1);
  });
});

describe("discount codes", () => {
  const signUpWith = (email: string, promoCode: string) =>
    accounts.createClubAccount({ clubName: "Code Club", name: "Cody Owner", email, password: "a long enough phrase", plan: "club", founding: false, promoCode, terms: true });

  beforeAll(async () => {
    await adminSql`insert into promo_codes (code, percent_off, months, max_uses) values ('FREEFORME', 100, null, 1), ('HALF3', 50, 3, null)`;
  });

  it("a free code at sign-up makes the club free with no trial end, and is single use", async () => {
    expect(await accounts.checkPromoCode("freeforme ")).toEqual({ code: "FREEFORME", percentOff: 100, months: null });
    const r = await signUpWith("free@example.test", "freeforme");
    expect(r.ok).toBe(true);
    const o = await club.getClubOverview(owner(r.ok ? r.value.userId : "", r.ok ? r.value.clubId : ""));
    expect(o.club).toMatchObject({ promoCode: "FREEFORME", discountPercent: 100, discountMonths: null, trialEndsOn: null });
    const again = await signUpWith("free2@example.test", "FREEFORME");
    expect(!again.ok && again.errors.promoCode).toMatch(/isn't valid/);
    const [{ n }] = await adminSql`select count(*)::int as n from users where email = 'free2@example.test'`;
    expect(n).toBe(0);
  });

  it("an unknown code stops sign-up with a clear message", async () => {
    const r = await signUpWith("nope@example.test", "MADEUP");
    expect(!r.ok && r.errors.promoCode).toMatch(/isn't valid/);
  });

  it("the owner can add a code later in Settings, once, and keeps the trial for a part discount", async () => {
    expect((await club.applyPromoCode(b, "nonsense")).ok).toBe(false);
    await expect(club.applyPromoCode({ ...b, role: "admin" }, "HALF3")).rejects.toThrow(/Not allowed/);
    expect((await club.applyPromoCode(b, "half3")).ok).toBe(true);
    const o = await club.getClubOverview(b);
    expect(o.club).toMatchObject({ promoCode: "HALF3", discountPercent: 50, discountMonths: 3 });
    expect(o.club.trialEndsOn).not.toBeNull();
    const again = await club.applyPromoCode(b, "HALF3");
    expect(!again.ok && again.errors.promoCode).toMatch(/already/);
    expect(accounts.describeDiscount(50, 3)).toBe("50% off for 3 months");
    expect(accounts.describeDiscount(100, null)).toBe("Free");
  });

  it("can't be read, changed or redeemed for another club by the app directly", async () => {
    await expect(appSql`select * from promo_codes`).rejects.toThrow(/permission denied/);
    await expect(appSql`update promo_codes set uses = 0`).rejects.toThrow(/permission denied/);
    const [{ pct }] = await appSql`select promo_redeem('HALF3', ${a.clubId}::uuid) as pct`;
    expect(pct).toBeNull();
  });
});

describe("Founding Clubs", () => {
  it("stops at 10", async () => {
    await adminSql`update clubs set founding = true`;
    const [{ n }] = await adminSql`select count(*)::int as n from clubs where founding`;
    const left = await accounts.foundingPlacesLeft();
    expect(left).toBe(Math.max(0, 10 - n));
    await adminSql`insert into clubs (name, slug, founding) select 'Filler ' || g, 'filler-' || g, true from generate_series(1, ${left}) g`;
    expect(await accounts.foundingPlacesLeft()).toBe(0);
    const r = await accounts.createClubAccount({ clubName: "Late Club", name: "Late Owner", email: "late@example.test", password: "a long enough phrase", plan: "club", founding: true, terms: true });
    expect(!r.ok && r.errors.form).toMatch(/all 10 Founding Club places/);
    const [{ u }] = await adminSql`select count(*)::int as u from users where email = 'late@example.test'`;
    expect(u).toBe(0);
  });
});

describe("student import", () => {
  const csv = [
    "First name,Surname,DOB,Grade,Art,Location,Status,Parent name,Email,Mobile,Medical",
    "Ella,Brown,14/03/2015,8th Keup,Taekwondo,Southport,Active,Kim Brown,kim@example.test,07700 900111,",
    "Finn,Brown,02/09/2017,10th kup,TKD,southport,Active,Kim Brown,KIM@example.test,07700 900111,Asthma",
    "Gail,Stone,21/06/1988,Blue,Kickboxing,Nowhere,Left,,gail@example.test,,",
    "Harry,Nope,01/01/2010,Purple,Taekwondo,,,,,,",
    ",NoFirst,,,,,,,,,",
    "Ella,Brown,14/03/2015,8th Keup,Taekwondo,Southport,Active,Kim Brown,kim@example.test,,",
  ].join("\n");

  it("previews without saving, matching families, belts, sites and duplicates", async () => {
    const before = await adminSql`select count(*)::int as n from students where club_id = ${a.clubId}`;
    const p = await importer.previewImport(a, csv, null, { siteId: "", discipline: "taekwondo" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const after = await adminSql`select count(*)::int as n from students where club_id = ${a.clubId}`;
    expect(after[0].n).toBe(before[0].n);
    const byName = Object.fromEntries(p.value.rows.map((r) => [`${r.firstName} ${r.lastName}`, r]));
    expect(byName["Ella Brown"].gradeName).toBe("8th Kup");
    expect(byName["Finn Brown"].gradeName).toBe("10th Kup");
    expect(byName["Finn Brown"].familyKey).toBe(byName["Ella Brown"].familyKey);
    expect(byName["Gail Stone"]).toMatchObject({ discipline: "kickboxing", gradeName: "Blue belt", status: "cancelled" });
    expect(byName["Gail Stone"].contact.relationship).toBe("self");
    expect(byName["Gail Stone"].warnings.join()).toMatch(/No site called "Nowhere"/);
    expect(byName["Harry Nope"].gradeId).toBeNull();
    expect(p.value.rows.filter((r) => r.skip).map((r) => r.skip).sort()).toEqual(["No student name", "Same student twice in the file"]);
    expect(p.value.summary).toMatchObject({ total: 6, toImport: 4, skipped: 2, withBelt: 3 });
  });

  it("imports in one go, then skips the same people next time", async () => {
    const r = await importer.runImport(a, csv, null, { siteId: "", discipline: "taekwondo" });
    expect(r.ok && r.value).toEqual({ students: 4, families: 3, belts: 3 });
    const [{ n }] = await adminSql`select count(*)::int as n from students s join guardians g on g.household_id = s.household_id where s.club_id = ${a.clubId} and g.email = 'kim@example.test'`;
    expect(n).toBe(2);
    const again = await importer.previewImport(a, csv, null, { siteId: "", discipline: "taekwondo" });
    expect(again.ok && again.value.summary.toImport).toBe(0);
    expect((await importer.runImport(a, csv, null, { siteId: "", discipline: "taekwondo" })).ok).toBe(false);
  });

  it("puts a new child into an existing family by email, and respects permissions", async () => {
    const r = await importer.runImport(a, "Name,Parent email\nIvy Brown,kim@example.test", null, { siteId: "", discipline: "taekwondo" });
    expect(r.ok && r.value).toEqual({ students: 1, families: 0, belts: 0 });
    await expect(importer.previewImport({ ...a, role: "assistant" }, csv, null, { siteId: "", discipline: "" })).rejects.toThrow(/Not allowed/);
    const [{ n }] = await adminSql`select count(*)::int as n from students where club_id = ${b.clubId} and first_name = 'Ivy'`;
    expect(n).toBe(0);
  });

  it("asks which column is the name when it can't tell", async () => {
    const r = await importer.previewImport(a, "Foo,Bar\n1,2", null, { siteId: "", discipline: "" });
    expect(!r.ok && r.errors.mapping).toMatch(/name/);
  });
});

describe("family sign-up link", () => {
  const tokenOf = async (actor: Actor) => (await join.joinLink(actor)).split("/join/")[1];
  const base = (over: Partial<import("@/data/join").JoinInput> = {}): import("@/data/join").JoinInput => ({
    who: "children",
    parentFirstName: "Pat",
    parentLastName: "Jones",
    email: "pat.jones@example.test",
    phone: "07700 900222",
    children: [
      { firstName: "Ruby", lastName: "", dateOfBirth: "2016-05-01", siteId: "" },
      { firstName: "Theo", lastName: "Smith", dateOfBirth: "2018-11-20", siteId: "", medical: "Nut allergy" },
    ],
    firstAidConsent: true,
    photoConsent: false,
    terms: true,
    ...over,
  });

  it("only works for set-up clubs, and shows the club's sites", async () => {
    const t = await tokenOf(a);
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    const f = await join.joinForm(t);
    expect(f?.clubName).toBe("Club A Taekwondo");
    expect(f?.sites.map((x) => x.name)).toEqual(["Southport"]);
    expect(await join.joinForm("0".repeat(64))).toBeNull();
    expect(await join.joinForm("../../etc")).toBeNull();
  });

  it("signs up a family with two children as members, in the right club only", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await join.submitJoin(await tokenOf(a), base());
    spy.mockRestore();
    expect(r.ok && r.value).toMatchObject({ clubName: "Club A Taekwondo", names: ["Ruby", "Theo"], paymentUrl: null });
    const kids = await adminSql`select s.club_id, s.first_name, s.last_name, s.status, s.source, s.medical_notes, s.first_aid_consent, g.email from students s join guardians g on g.household_id = s.household_id where g.email = 'pat.jones@example.test' order by s.first_name`;
    expect(kids.map((k) => [k.first_name, k.last_name, k.status, k.source, k.club_id === a.clubId])).toEqual([
      ["Ruby", "Jones", "active", "join_link", true],
      ["Theo", "Smith", "active", "join_link", true],
    ]);
    expect(kids[1].medical_notes).toBe("Nut allergy");
    const recent = await join.recentSignups(a);
    expect(recent.map((x) => x.firstName).sort()).toEqual(["Ruby", "Theo"]);
    expect(await join.recentSignups(b)).toEqual([]);
    const list = await students.listStudents(a, { q: "Ruby" });
    expect(list[0].isNewSignup).toBe(true);
  });

  it("adds a sibling to the same family next time, without doubling up", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await join.submitJoin(await tokenOf(a), base({ children: [{ firstName: "Ruby", dateOfBirth: "2016-05-01", siteId: "" }, { firstName: "Zac", dateOfBirth: "2020-01-02", siteId: "" }] }));
    spy.mockRestore();
    expect(r.ok).toBe(true);
    const [{ households, kids }] = await adminSql`select count(distinct s.household_id)::int as households, count(*)::int as kids from students s join guardians g on g.household_id = s.household_id where g.email = 'pat.jones@example.test'`;
    expect([households, kids]).toEqual([1, 3]);
  });

  it("lets an adult sign themselves up", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await join.submitJoin(await tokenOf(a), base({ who: "me", email: "adult@example.test", children: [], myDateOfBirth: "1990-02-03" }));
    spy.mockRestore();
    expect(r.ok && r.value.names).toEqual(["Pat"]);
    const [g] = await adminSql`select relationship from guardians where email = 'adult@example.test'`;
    expect(g.relationship).toBe("self");
  });

  it("checks the form and refuses a reset link", async () => {
    const t = await tokenOf(a);
    const bad = await join.submitJoin(t, base({ email: "nope", terms: false, children: [{ firstName: "", dateOfBirth: "2099-01-01", siteId: "" }] }));
    expect(!bad.ok && bad.errors).toMatchObject({ email: expect.any(String), terms: expect.any(String), "children.0.firstName": expect.any(String), "children.0.dateOfBirth": expect.any(String) });
    await expect(join.resetJoinLink({ ...a, role: "admin" })).rejects.toThrow(/Not allowed/);
    await join.resetJoinLink(a);
    expect(await tokenOf(a)).not.toBe(t);
    const old = await join.submitJoin(t, base());
    expect(!old.ok && old.errors.form).toMatch(/link has changed/);
  });

  it("lets staff email the link, and not assistants", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await join.sendJoinLink(a, "new.parent@example.test")).ok).toBe(true);
    spy.mockRestore();
    expect((await join.sendJoinLink(a, "bad")).ok).toBe(false);
    await expect(join.sendJoinLink({ ...a, role: "assistant" }, "x@example.test")).rejects.toThrow(/Not allowed/);
    const [{ n }] = await adminSql`select count(*)::int as n from email_log where template = 'join-invite' and to_email = 'new.parent@example.test'`;
    expect(n).toBe(1);
  });
});

describe("messages to parents", () => {
  let m: Actor;
  let north = "";
  let south = "";
  let classId = "";
  const quiet = () => vi.spyOn(console, "log").mockImplementation(() => {});

  beforeAll(async () => {
    const r0 = await accounts.createClubAccount({ clubName: "Message Club", name: "Mo Owner", email: "msg-owner@example.test", password: "a long enough phrase", plan: "club", founding: false, terms: true });
    if (!r0.ok) throw new Error(JSON.stringify(r0.errors));
    m = owner(r0.value.userId, r0.value.clubId);
    await accounts.completeSetup(m, { disciplines: ["karate"], siteName: "North", siteAddress: "", syllabus: {} });
    await club.addSite(m, "South", "");
    const o = await club.getClubOverview(m);
    north = o.sites.find((x) => x.name === "North")!.id;
    south = o.sites.find((x) => x.name === "South")!.id;
    const add = async (first: string, siteId: string, guardian: { first: string; email: string | null }, householdId?: string) => {
      const r = await studentsEdit.createStudent(m, {
        firstName: first, lastName: "Test", siteId, status: "active", firstAidConsent: true, photoConsent: false,
        ...(householdId ? { householdId } : { guardianFirstName: guardian.first, guardianLastName: "Test", guardianEmail: guardian.email ?? "", relationship: "parent" }),
      });
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      return r.value.id;
    };
    const amy = await add("Amy", north, { first: "Ann", email: "ann@example.test" });
    const [{ household_id }] = await adminSql`select household_id from students where id = ${amy}`;
    await add("Ben", north, { first: "Ann", email: null }, household_id); // sibling, same family
    await add("Cal", north, { first: "Cara", email: null }); // family with no email
    const dee = await add("Dee", south, { first: "Dan", email: "DAN@example.test" });
    // A class at North, with Amy there last week.
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    const weekday = ((lastWeek.getUTCDay() + 6) % 7) + 1;
    const c = await classes.createClass(m, { name: "Little Ninjas", siteId: north, discipline: "karate", weekday: String(weekday), startsAt: "17:00", durationMinutes: "45", capacity: "" });
    classId = c.ok ? c.value.id : "";
    await classes.setAttendance(m, classId, lastWeek.toISOString().slice(0, 10), amy, true);
    void dee;
  });

  it("counts families, one email per address, and says who has no email", async () => {
    const all = await msgs.previewAudience(m, { kind: "all" });
    expect(all.ok && all.value).toMatchObject({ label: "Everyone", students: 4, families: 3, emails: 2, familiesWithoutEmail: 1 });
    const s = await msgs.previewAudience(m, { kind: "site", siteId: south });
    expect(s.ok && s.value).toMatchObject({ label: "Everyone at South", emails: 1 });
    const c = await msgs.previewAudience(m, { kind: "class", classId });
    expect(c.ok && c.value).toMatchObject({ students: 1, emails: 1 });
    expect(c.ok && c.value.label).toMatch(/^Little Ninjas · /);
  });

  it("sends, records each recipient, and shows it in the history", async () => {
    const spy = quiet();
    const r = await msgs.sendMessage(m, { audience: { kind: "all" }, subject: "No class Monday", body: "Hi all,\n\nThe hall is closed on Monday.\n\nSee you Wednesday." });
    spy.mockRestore();
    expect(r.ok && r.value).toMatchObject({ sent: 2, failed: 0 });
    const id = r.ok ? r.value.id : "";
    const detail = await msgs.getMessage(m, id);
    expect(detail?.recipients.map((x) => [x.email, x.status]).sort()).toEqual([["ann@example.test", "logged"], ["dan@example.test", "logged"]]);
    expect(detail).toMatchObject({ subject: "No class Monday", audienceLabel: "Everyone", recipientCount: 2, sentCount: 2 });
    expect((await msgs.listMessages(m)).map((x) => x.subject)).toEqual(["No class Monday"]);
  });

  it("checks the message and refuses an empty audience", async () => {
    const bad = await msgs.sendMessage(m, { audience: { kind: "nope" }, subject: "", body: "" });
    expect(!bad.ok && bad.errors).toMatchObject({ audience: expect.any(String), subject: expect.any(String), body: expect.any(String) });
    const o = await club.getClubOverview(m);
    await club.addSite(m, "Empty Hall", "");
    const empty = (await club.getClubOverview(m)).sites.find((x) => x.name === "Empty Hall")!.id;
    const r = await msgs.sendMessage(m, { audience: { kind: "site", siteId: empty }, subject: "Hi", body: "Hi" });
    expect(!r.ok && r.errors.audience).toMatch(/nobody/);
    void o;
  });

  it("keeps instructors to their own sites and messages, and assistants out", async () => {
    const coach: Actor = { ...m, userId: a.userId, role: "instructor", sites: [north] };
    const p = await msgs.previewAudience(coach, { kind: "all" });
    expect(p.ok && p.value).toMatchObject({ label: "Everyone at North", emails: 1 });
    await expect(msgs.previewAudience(coach, { kind: "site", siteId: south })).rejects.toThrow(/Not allowed/);
    expect(await msgs.listMessages(coach)).toEqual([]);
    await expect(msgs.listMessages({ ...m, role: "assistant" })).rejects.toThrow(/Not allowed/);
  });

  it("keeps clubs apart", async () => {
    const [{ id }] = await adminSql`select id from messages where club_id = ${m.clubId} limit 1`;
    expect(await msgs.getMessage(b, id)).toBeNull();
    expect(await msgs.listMessages(b)).toEqual([]);
    await expect(msgs.previewAudience(b, { kind: "class", classId })).rejects.toThrow(/Not allowed/);
  });
});

describe("club payments and paying at sign-up", () => {
  let p: Actor;
  let site = "";
  const quiet = () => vi.spyOn(console, "log").mockImplementation(() => {});

  beforeAll(async () => {
    process.env.PAYMENTS_FAKE = "1";
    const r0 = await accounts.createClubAccount({ clubName: "Pay Club", name: "Pat Owner", email: "pay-owner@example.test", password: "a long enough phrase", plan: "club", founding: false, terms: true });
    if (!r0.ok) throw new Error(JSON.stringify(r0.errors));
    p = owner(r0.value.userId, r0.value.clubId);
    await accounts.completeSetup(p, { disciplines: ["judo"], siteName: "Dojo", siteAddress: "", syllabus: {} });
    site = (await club.getClubOverview(p)).sites[0].id;
  });

  it("connects the club's own account, but only for the club that started it", async () => {
    const url = new URL(pay.connectUrl(p, "gocardless", "http://localhost/cb"));
    const state = url.searchParams.get("state");
    expect((await pay.finishConnect(a, "gocardless", "fake-code", state, "http://localhost/cb")).ok).toBe(false);
    expect((await pay.finishConnect(p, "stripe", "fake-code", state, "http://localhost/cb")).ok).toBe(false);
    const r = await pay.finishConnect(p, "gocardless", "fake-code", state, "http://localhost/cb");
    expect(r.ok).toBe(true);
    const st = await pay.paymentSettings(p);
    expect(st.account?.provider).toBe("gocardless");
    const [row] = await adminSql`select account_id, access_token_enc from club_payment_accounts where club_id = ${p.clubId}`;
    expect(row.access_token_enc).not.toContain("fake-token");
    expect(await pay.clubForAccount("gocardless", row.account_id)).toBe(p.clubId);
    expect(await pay.clubForAccount("stripe", row.account_id)).toBeNull();
    expect(() => pay.connectUrl({ ...p, role: "admin" }, "stripe", "x")).toThrow(/Not allowed/);
    await expect(appSql`select * from club_payment_accounts`).resolves.toEqual([]); // no club context, nothing visible
  });

  it("sets prices, with sensible checks", async () => {
    expect((await pay.addPlan(p, { name: "K", amount: "abc", interval: "monthly" })).ok).toBe(false);
    expect((await pay.addPlan(p, { name: "Kids monthly", amount: "£35", interval: "monthly" })).ok).toBe(true);
    expect((await pay.addPlan(p, { name: "Adults yearly", amount: "300.50", interval: "annual" })).ok).toBe(true);
    const plans = (await pay.paymentSettings(p)).plans;
    expect(plans.map((x) => [x.name, x.amountPence, x.interval])).toEqual([["Kids monthly", 3500, "monthly"], ["Adults yearly", 30050, "annual"]]);
    await expect(pay.addPlan({ ...p, role: "instructor" }, { name: "X", amount: "1", interval: "monthly" })).rejects.toThrow(/Not allowed/);
    await expect(pay.paymentSettings({ ...p, role: "instructor" })).rejects.toThrow(/Not allowed/);
  });

  it("hides old prices from the sign-up form but keeps them for existing members", async () => {
    const yearly = (await pay.listPlans(p)).plans.find((x) => x.name === "Adults yearly")!;
    await pay.setPlanOnSignup(p, yearly.id, false);
    const token = (await join.joinLink(p)).split("/join/")[1];
    expect((await join.joinForm(token))?.payment?.plans.map((x) => x.name)).toEqual(["Kids monthly"]);
    expect((await pay.listPlans(p)).plans.find((x) => x.id === yearly.id)?.showOnSignup).toBe(false); // still listed for staff
    await expect(pay.setPlanOnSignup({ ...p, role: "instructor" }, yearly.id, true)).rejects.toThrow(/Not allowed/);
    await pay.setPlanOnSignup(p, yearly.id, true);
    expect((await join.joinForm(token))?.payment?.plans).toHaveLength(2);
  });

  it("asks for a membership on the sign-up form, then hands over to Direct Debit", async () => {
    const token = (await join.joinLink(p)).split("/join/")[1];
    const form = await join.joinForm(token);
    expect(form?.payment?.provider).toBe("gocardless");
    const kids = form!.payment!.plans.find((x) => x.name === "Kids monthly")!.id;
    const input = {
      who: "children" as const, parentFirstName: "Gwen", parentLastName: "Hall", email: "gwen@example.test", phone: "07700 900333",
      children: [{ firstName: "Ivy", dateOfBirth: "2016-01-01", siteId: site }, { firstName: "Jay", dateOfBirth: "2018-02-02", siteId: site, planId: kids }],
      firstAidConsent: true, photoConsent: false, terms: true,
    };
    const missing = await join.submitJoin(token, input, { success: (id) => `http://x/done?setup=${id}`, cancel: "http://x/cancel" });
    expect(!missing.ok && missing.errors["children.0.planId"]).toMatch(/membership/);
    const spy = quiet();
    const r = await join.submitJoin(token, { ...input, children: input.children.map((c) => ({ ...c, planId: kids })) }, { success: (id) => `http://x/done?setup=${id}`, cancel: "http://x/cancel" });
    spy.mockRestore();
    expect(r.ok && r.value.paymentUrl).toMatch(/^http:\/\/x\/done\?setup=[0-9a-f-]{36}&fake=1$/);
    const setupId = r.ok ? new URL(r.value.paymentUrl!).searchParams.get("setup")! : "";
    const setup = await pay.loadSetup(p.clubId, setupId);
    expect(setup?.status).toBe("pending");
    expect(setup?.items.map((i) => [i.firstName, i.plan?.amountPence])).toEqual([["Ivy", 3500], ["Jay", 3500]]);
    expect((await join.joinSetupStatus(token, setupId))?.status).toBe("pending");

    // The provider says it's done: memberships start, students become Active, mandate saved. Twice is harmless.
    const subs = setup!.items.map((i) => ({ studentId: i.studentId, planId: i.planId, subscriptionId: `SB_${i.firstName}` }));
    await pay.completeSetup(p.clubId, setupId, { customerId: "CU1", mandateId: "MD1", subscriptions: subs });
    await pay.completeSetup(p.clubId, setupId, { customerId: "CU1", mandateId: "MD1", subscriptions: subs });
    const ms = await adminSql`select m.status, m.provider_subscription_id, s.status as student from memberships m join students s on s.id = m.student_id where m.club_id = ${p.clubId} order by m.provider_subscription_id`;
    expect(ms.map((x) => [x.status, x.provider_subscription_id, x.student])).toEqual([["active", "SB_Ivy", "active"], ["active", "SB_Jay", "active"]]);
    const [md] = await adminSql`select status, provider, provider_mandate_id from mandates where club_id = ${p.clubId}`;
    expect(md).toMatchObject({ status: "pending_submission", provider: "gocardless", provider_mandate_id: "MD1" });
    expect((await join.joinSetupStatus(token, setupId))?.status).toBe("completed");
  });

  it("tracks the mandate, payments and cancellations from the provider", async () => {
    await pay.updateMandate(p.clubId, { mandateId: "MD1" }, "active");
    await pay.recordPayment(p.clubId, { providerPaymentId: "PM1", mandateId: "MD1", amountPence: 7000, chargeDate: "2026-11-01", status: "pending", description: "Membership" });
    await pay.recordPayment(p.clubId, { providerPaymentId: "PM1", mandateId: "MD1", amountPence: 7000, chargeDate: "2026-11-01", status: "paid_out", description: "Membership" });
    await pay.recordPayment(p.clubId, { providerPaymentId: "PM2", mandateId: "NOPE", amountPence: 1, chargeDate: "2026-11-01", status: "failed", description: "x" });
    const st = await pay.paymentSettings(p);
    expect(st.mandates).toEqual({ active: 1 });
    expect(st.recent.map((x) => [x.amountPence, x.status, x.family])).toEqual([[7000, "paid_out", "Hall family"]]);
    await pay.cancelMembership(p.clubId, "SB_Ivy");
    const [c] = await adminSql`select status, ends_on from memberships where provider_subscription_id = 'SB_Ivy'`;
    expect(c.status).toBe("cancelled");
    expect(c.ends_on).not.toBeNull();
  });

  it("dashboard money summary and student filters", async () => {
    const m = await pay.moneySummary(p);
    expect(m.expectedMonthlyPence).toBe(3500); // Jay on Kids monthly £35 (Ivy was cancelled above)
    expect(m.outstandingPence).toBe(0);
    await expect(pay.moneySummary({ ...p, role: "instructor" })).rejects.toThrow(/Not allowed/);
    const all = await students.listStudents(p);
    expect((await students.listStudents(p, { status: "active" })).length).toBe(all.filter((x) => x.status === "active").length);
    expect(await students.listStudents(p, { filter: "payment-problems" })).toEqual([]);
    expect((await students.listStudents(p, { filter: "no-dd" })).map((x) => x.name)).toEqual([]);
    expect((await students.listStudents(p, { siteId: site })).length).toBe(all.length);
  });

  it("staff add a membership: emails the Direct Debit link to a family that isn't paying yet", async () => {
    const kids = (await pay.listPlans(p)).plans.find((x) => x.name === "Kids monthly")!.id;
    const made = await studentsEdit.createStudent(p, { firstName: "Max", lastName: "Reed", siteId: site, status: "trial", firstAidConsent: true, photoConsent: true, relationship: "parent", guardianFirstName: "Rita", guardianLastName: "Reed", guardianEmail: "rita@example.test", guardianPhone: "07700 900444" });
    if (!made.ok) throw new Error(JSON.stringify(made.errors));
    expect((await pay.addStudentMembership(p, made.value.id, { planId: "" })).ok).toBe(false);
    const spy = quiet();
    const r = await pay.addStudentMembership(p, made.value.id, { planId: kids });
    spy.mockRestore();
    expect(r.ok && r.value.emailed).toBe("rita@example.test");
    const [setup] = await adminSql`select status, items from payment_setups where club_id = ${p.clubId} and items::text like ${"%" + made.value.id + "%"}`;
    expect(setup.status).toBe("pending");
    const [{ n }] = await adminSql`select count(*)::int as n from memberships where student_id = ${made.value.id}`;
    expect(n).toBe(0); // starts once they've set up the Direct Debit

    // A family already paying by Direct Debit: the membership just starts.
    const [ivy] = await adminSql`select id from students where club_id = ${p.clubId} and first_name = 'Ivy'`;
    const r2 = await pay.addStudentMembership(p, ivy.id, { planId: kids });
    expect(r2.ok && r2.value.emailed).toBeNull();
    await expect(pay.addStudentMembership({ ...p, role: "assistant" }, ivy.id, { planId: kids })).rejects.toThrow(/Not allowed/);
  });

  it("adds the club's sign-up fee to the first payment, once per member", async () => {
    expect((await pay.setSignupFee(p, "abc")).ok).toBe(false);
    expect((await pay.setSignupFee(p, "£25")).ok).toBe(true);
    await expect(pay.setSignupFee({ ...p, role: "instructor" }, "1")).rejects.toThrow(/Not allowed/);
    const token = (await join.joinLink(p)).split("/join/")[1];
    const form = await join.joinForm(token);
    expect(form?.payment?.signupFeePence).toBe(2500);
    const kids = form!.payment!.plans.find((x) => x.name === "Kids monthly")!.id;
    const spy = quiet();
    const r = await join.submitJoin(token, {
      who: "children", parentFirstName: "Fay", parentLastName: "Fee", email: "fay@example.test", phone: "07700 900666",
      children: [{ firstName: "Al", dateOfBirth: "2016-01-01", siteId: site, planId: kids }, { firstName: "Bo", dateOfBirth: "2017-01-01", siteId: site, planId: kids }],
      firstAidConsent: true, photoConsent: false, terms: true,
    }, { success: (id) => `http://x/done?setup=${id}`, cancel: "http://x/cancel" });
    spy.mockRestore();
    const setupId = r.ok ? new URL(r.value.paymentUrl!).searchParams.get("setup")! : "";
    const setup = await pay.loadSetup(p.clubId, setupId);
    expect(setup?.signupFeePence).toBe(5000);
    expect((await pay.setSignupFee(p, "")).ok).toBe(true);
    expect((await pay.listPlans(p)).signupFeePence).toBe(0);
  });

  it("without Direct Debit, families still pick a price and join as members", async () => {
    const token = (await join.joinLink(a)).split("/join/")[1];
    expect((await join.joinForm(token))?.payment).toBeNull(); // no prices, no choice
    await pay.disconnectPayments(p);
    const t2 = (await join.joinLink(p)).split("/join/")[1];
    const form = await join.joinForm(t2);
    expect(form?.payment?.provider).toBeNull();
    const yearly = form!.payment!.plans.find((x) => x.name === "Adults yearly")!.id;
    const spy = quiet();
    const r = await join.submitJoin(t2, {
      who: "me", parentFirstName: "Olu", parentLastName: "Ade", email: "olu@example.test", phone: "07700 900555", myDateOfBirth: "1985-03-03", myPlanId: yearly,
      children: [], firstAidConsent: true, photoConsent: true, terms: true,
    }, { success: (id) => `http://x/done?setup=${id}`, cancel: "http://x/cancel" });
    spy.mockRestore();
    expect(r.ok && r.value.paymentUrl).toBeNull();
    const [m] = await adminSql`select m.status, s.status as student from memberships m join students s on s.id = m.student_id where s.first_name = 'Olu'`;
    expect(m).toMatchObject({ status: "active", student: "active" });
    // Staff adding a membership without Direct Debit: it starts straight away.
    const [max] = await adminSql`select id from students where club_id = ${p.clubId} and first_name = 'Max'`;
    const r2 = await pay.addStudentMembership(p, max.id, { planId: yearly });
    expect(r2.ok && r2.value.emailed).toBeNull();
    const [mm] = await adminSql`select s.status from memberships m join students s on s.id = m.student_id where s.id = ${max.id}`;
    expect(mm.status).toBe("active");
  });
});

describe("leads", () => {
  const quiet = () => vi.spyOn(console, "log").mockImplementation(() => {});
  let l: Actor;
  let site: string;
  let classId: string;
  const nextWeekday = (weekday: number) => {
    const d = new Date(Date.now() + 2 * 86_400_000);
    while (((d.getUTCDay() + 6) % 7) + 1 !== weekday) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    const r0 = await accounts.createClubAccount({ clubName: "Lead Club", name: "Lee Owner", email: "lead-owner@example.test", password: "a long enough phrase", plan: "club", founding: false, terms: true });
    if (!r0.ok) throw new Error(JSON.stringify(r0.errors));
    l = owner(r0.value.userId, r0.value.clubId);
    await accounts.completeSetup(l, { disciplines: ["taekwondo"], siteName: "Southside", siteAddress: "1 High St", syllabus: {} });
    site = (await club.getClubOverview(l)).sites[0].id;
    const c = await classes.createClass(l, { name: "Kids TKD", siteId: site, discipline: "taekwondo", weekday: "3", startsAt: "17:30", durationMinutes: "45", capacity: "" });
    if (!c.ok) throw new Error(JSON.stringify(c.errors));
    classId = c.value.id;
  });

  it("adds a lead with a trial class, works out the time and sends the welcome", async () => {
    expect((await leads.addLead(l, { firstName: "Nia" })).ok).toBe(false); // needs email or phone
    const wrongDay = await leads.addLead(l, { firstName: "Nia", email: "nia@example.test", classId, sessionDate: nextWeekday(4) });
    expect(!wrongDay.ok && wrongDay.errors.sessionDate).toMatch(/Wednesday/);
    const spy = quiet();
    const r = await leads.addLead(l, { firstName: "Nia", lastName: "Shaw", email: "Nia@Example.test", phone: "07700 900777", studentName: "Kai", studentAge: "8", classId, sessionDate: nextWeekday(3), source: "Facebook" });
    spy.mockRestore();
    expect(r.ok && r.value.emailed).toBe(true);
    const lead = await leads.getLead(l, r.ok ? r.value.id : "");
    expect(lead).toMatchObject({ status: "booked", email: "nia@example.test", site: "Southside", className: "Kids TKD", studentName: "Kai" });
    expect(lead!.sessionAt!.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })).toBe("17:30");
    expect(lead!.welcomeSentAt).not.toBeNull();
    const [{ n }] = await adminSql`select count(*)::int as n from email_log where template = 'lead-welcome' and club_id = ${l.clubId}`;
    expect(n).toBe(1);
    expect((await leads.listLeads(a)).leads).toEqual([]); // other clubs see nothing
    await expect(leads.addLead({ ...l, role: "assistant" }, { firstName: "X", email: "x@example.test" })).rejects.toThrow(/Not allowed/);
  });

  it("reminds leads the day before their trial, once", async () => {
    const spy = quiet();
    const r = await leads.addLead(l, { firstName: "Rob", email: "rob@example.test", classId, sessionDate: nextWeekday(3) });
    const id = r.ok ? r.value.id : "";
    await adminSql`update leads set session_at = now() + interval '20 hours', created_at = now() - interval '3 days' where id = ${id}`;
    const first = await leads.sendLeadReminders();
    const second = await leads.sendLeadReminders();
    spy.mockRestore();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(second.due).toBe(0);
    expect((await leads.getLead(l, id))!.reminderSentAt).not.toBeNull();
    // Re-booking clears it so the new session gets a reminder too.
    const spy2 = quiet();
    expect((await leads.bookLeadSession(l, id, { classId, sessionDate: nextWeekday(3) })).ok).toBe(true);
    spy2.mockRestore();
    expect((await leads.getLead(l, id))!.reminderSentAt).toBeNull();
  });

  it("shows the lead as joined when the family signs up with the same email", async () => {
    const token = (await join.joinLink(l)).split("/join/")[1];
    const spy = quiet();
    const r = await join.submitJoin(token, {
      who: "children", parentFirstName: "Nia", parentLastName: "Shaw", email: "nia@example.test", phone: "07700 900777",
      children: [{ firstName: "Kai", dateOfBirth: "2018-01-01", siteId: site }], firstAidConsent: true, photoConsent: true, terms: true,
    });
    spy.mockRestore();
    expect(r.ok).toBe(true);
    const list = await leads.listLeads(l);
    const nia = list.leads.find((x) => x.firstName === "Nia")!;
    expect(nia.status).toBe("converted");
    expect(nia.convertedStudentId).not.toBeNull();
    expect(list.counts.converted).toBe(1);
    // Staff adding a student with a lead's phone number converts it too.
    const spy2 = quiet();
    const p2 = await leads.addLead(l, { firstName: "Ola", phone: "+44 7700 900888" });
    spy2.mockRestore();
    const made = await studentsEdit.createStudent(l, { firstName: "Ola", lastName: "Ray", siteId: site, status: "active", firstAidConsent: true, photoConsent: true, relationship: "self", guardianFirstName: "Ola", guardianLastName: "Ray", guardianPhone: "07700 900888" });
    expect(made.ok).toBe(true);
    expect((await leads.getLead(l, p2.ok ? p2.value.id : ""))!.status).toBe("converted");
  });

  it("keeps the family's address and emergency contact, from sign-up and from the profile", async () => {
    const token = (await join.joinLink(l)).split("/join/")[1];
    const spy = quiet();
    const r = await join.submitJoin(token, {
      who: "children", parentFirstName: "Ade", parentLastName: "Bell", email: "ade@example.test", phone: "07700 900123",
      addressLine1: "1 Hall St", town: "Southport", postcode: "pr9 0sf", emergencyName: "Gran Bell", emergencyPhone: "07700 900124",
      children: [{ firstName: "Zoe", dateOfBirth: "2017-01-01", siteId: site }], firstAidConsent: true, photoConsent: true, terms: true,
    });
    spy.mockRestore();
    expect(r.ok).toBe(true);
    const [zoe] = await adminSql`select id from students where club_id = ${l.clubId} and first_name = 'Zoe'`;
    let prof = (await students.getStudentProfile(l, zoe.id))!;
    expect(prof.contact).toMatchObject({ addressLine1: "1 Hall St", town: "Southport", postcode: "PR9 0SF", emergencyName: "Gran Bell" });
    expect(prof.guardians[0]).toMatchObject({ email: "ade@example.test", phone: "07700 900123" });
    const g = prof.guardians[0];
    const bad = await studentsEdit.updateFamilyContact(l, zoe.id, { guardians: [{ id: g.id, firstName: "Ade", email: "nope" }] });
    expect(bad.ok).toBe(false);
    const ok = await studentsEdit.updateFamilyContact(l, zoe.id, { guardians: [{ id: g.id, firstName: "Adaeze", lastName: "Bell", email: "adaeze@example.test", phone: "07700 900125" }], addressLine1: "2 Hall St", town: "Southport", postcode: "PR9 0SF" });
    expect(ok.ok).toBe(true);
    prof = (await students.getStudentProfile(l, zoe.id))!;
    expect(prof.guardians[0]).toMatchObject({ name: "Adaeze Bell", phone: "07700 900125" });
    expect(prof.contact).toMatchObject({ addressLine1: "2 Hall St", emergencyName: null });
    const asAssistant = await students.getStudentProfile({ ...l, role: "assistant" }, zoe.id).catch(() => null);
    if (asAssistant) expect(asAssistant.contact).toBeNull(); // contact details are for staff who edit students
  });

  it("edits sites, and only removes one that nothing depends on", async () => {
    expect((await club.updateSite(l, site, "Southside Dojo", "2 High St")).ok).toBe(true);
    expect((await club.getClubOverview(l)).sites[0]).toMatchObject({ name: "Southside Dojo", address: "2 High St" });
    const last = await club.removeSite(l, site);
    expect(!last.ok && last.errors.form).toMatch(/at least one site/);
    expect((await club.addSite(l, "Northside", "")).ok).toBe(true);
    const north = (await club.getClubOverview(l)).sites.find((x) => x.name === "Northside")!.id;
    const busy = await club.removeSite(l, site);
    expect(!busy.ok && busy.errors.form).toMatch(/students/);
    await expect(club.removeSite({ ...l, role: "instructor" }, north)).rejects.toThrow(/Not allowed/);
    expect((await club.removeSite(l, north)).ok).toBe(true);
    expect((await club.getClubOverview(l)).sites.map((x) => x.name)).toEqual(["Southside Dojo"]);
  });
});

describe("existing Stripe account and Direct Debit takeover", () => {
  let c: Actor;
  let site: string;
  let studentId: string;
  let planId: string;
  const calls: Array<{ method: string; path: string; body: string; key: string }> = [];
  const future = Math.floor(Date.now() / 1000) + 10 * 86_400;
  const sub = (id: string, email: string, pm: unknown) => ({
    id, status: "active", cancel_at_period_end: false, current_period_end: future, metadata: {},
    default_payment_method: pm,
    customer: { id: `cus_${id}`, email, name: "Fam Parent", invoice_settings: { default_payment_method: null } },
    items: { data: [{ quantity: 1, price: { unit_amount: 3500, recurring: { interval: "month", interval_count: 1 }, product: { name: "Kids monthly (old system)" } } }] },
  });
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    const r0 = await accounts.createClubAccount({ clubName: "Own Stripe Club", name: "Olu Owner", email: "own-owner@example.test", password: "a long enough phrase", plan: "club", founding: false, terms: true });
    if (!r0.ok) throw new Error(JSON.stringify(r0.errors));
    c = owner(r0.value.userId, r0.value.clubId);
    await accounts.completeSetup(c, { disciplines: ["taekwondo"], siteName: "Main", siteAddress: "", syllabus: {} });
    site = (await club.getClubOverview(c)).sites[0].id;
    const made = await studentsEdit.createStudent(c, { firstName: "Kit", lastName: "Fam", siteId: site, status: "active", firstAidConsent: true, photoConsent: true, relationship: "parent", guardianFirstName: "Fam", guardianLastName: "Parent", guardianEmail: "fam@example.test", guardianPhone: "07700 900999" });
    if (!made.ok) throw new Error(JSON.stringify(made.errors));
    studentId = made.value.id;
    const pl = await pay.addPlan(c, { name: "Kids monthly", amount: "35", interval: "monthly" });
    if (!pl.ok) throw new Error("plan");
    planId = pl.value.id;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const key = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
      calls.push({ method, path: url.pathname, body: String(init?.body ?? ""), key });
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
      if (!url.hostname.endsWith("stripe.com")) return realFetch(input, init);
      if (method === "GET" && url.pathname === "/v1/account") return json({ id: "acct_own1", settings: { dashboard: { display_name: "Own Club" } } });
      if (method === "POST" && url.pathname === "/v1/webhook_endpoints") return json({ id: "we_own1", secret: "whsec_own1" });
      if (method === "DELETE") return json({ deleted: true });
      if (method === "GET" && url.pathname === "/v1/subscriptions") return json({ has_more: false, data: [sub("sub_1", "fam@example.test", { id: "pm_bacs", type: "bacs_debit", bacs_debit: { last4: "2345" } }), sub("sub_2", "nobody@example.test", null)] });
      if (method === "GET" && url.pathname === "/v1/subscriptions/sub_1") return json(sub("sub_1", "fam@example.test", { id: "pm_bacs", type: "bacs_debit" }));
      if (method === "POST" && url.pathname === "/v1/products") return json({ id: "prod_1" });
      if (method === "POST" && url.pathname === "/v1/subscriptions") return json({ id: "sub_new1" });
      if (method === "POST" && url.pathname === "/v1/subscriptions/sub_1") return json({ id: "sub_1" });
      return json({ error: { message: `unexpected ${method} ${url.pathname}` } }, 400);
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("connects the club's own Stripe with a key and sets up a webhook on it", async () => {
    expect((await ownStripe.connectStripeKey(c, "not-a-key", "https://junbi.test")).ok).toBe(false);
    await expect(ownStripe.connectStripeKey({ ...c, role: "admin" }, "sk_test_abcdefghijklmnop", "https://junbi.test")).rejects.toThrow(/Not allowed/);
    const r = await ownStripe.connectStripeKey(c, "  sk_test_abcdefghijklmnop ", "https://junbi.test");
    expect(r.ok && r.value).toMatchObject({ accountName: "Own Club", testMode: true });
    const wh = calls.find((x) => x.path === "/v1/webhook_endpoints")!;
    expect(decodeURIComponent(wh.body)).toContain(`url=https://junbi.test/api/payments/webhook/stripe?club=${c.clubId}`);
    expect(wh.key).toBe("sk_test_abcdefghijklmnop");
    const st = await pay.paymentSettings(c);
    expect(st.account).toMatchObject({ provider: "stripe", accountId: "acct_own1", ownKey: true, testMode: true });
    const [row] = await adminSql`select access_token_enc from club_payment_accounts where club_id = ${c.clubId}`;
    expect(row.access_token_enc).not.toContain("sk_test_"); // stored encrypted
  });

  it("lists the running Direct Debits matched to families, and takes one over without a double charge", async () => {
    const opts = await ownStripe.takeoverOptions(c);
    expect(opts.connected).toBe(true);
    const fam = opts.rows.find((r) => r.subscriptionId === "sub_1")!;
    expect(fam).toMatchObject({ canTakeOver: true, amountPence: 3500, interval: "monthly", method: "Direct Debit ··2345", suggestedPlanId: planId });
    expect(fam.household?.students.map((s) => s.id)).toEqual([studentId]);
    expect(opts.rows.find((r) => r.subscriptionId === "sub_2")).toMatchObject({ canTakeOver: false, household: null });

    calls.length = 0;
    const r = await ownStripe.takeOver(c, [{ subscriptionId: "sub_1", studentId, planId }]);
    expect(r.ok && r.value.results).toEqual([expect.objectContaining({ subscriptionId: "sub_1", ok: true })]);
    const created = calls.find((x) => x.method === "POST" && x.path === "/v1/subscriptions")!;
    const body = new URLSearchParams(created.body);
    expect(body.get("customer")).toBe("cus_sub_1");
    expect(body.get("default_payment_method")).toBe("pm_bacs");
    expect(body.get("trial_end")).toBe(String(future)); // nothing charged before the old next payment date
    expect(body.get("items[0][price_data][unit_amount]")).toBe("3500");
    const stopped = new URLSearchParams(calls.find((x) => x.path === "/v1/subscriptions/sub_1" && x.method === "POST")!.body);
    expect(stopped.get("cancel_at_period_end")).toBe("true");
    expect(stopped.get("metadata[junbi_replaced_by]")).toBe("sub_new1");

    const [m] = await adminSql`select status, provider_subscription_id, starts_on::text as starts_on from memberships where student_id = ${studentId}`;
    expect(m).toMatchObject({ status: "active", provider_subscription_id: "sub_new1", starts_on: new Date(future * 1000).toISOString().slice(0, 10) });
    const [md] = await adminSql`select provider, provider_customer_id, status from mandates where club_id = ${c.clubId}`;
    expect(md).toMatchObject({ provider: "stripe", provider_customer_id: "cus_sub_1", status: "active" });
    await expect(ownStripe.takeOver({ ...c, role: "instructor" }, [{ subscriptionId: "sub_1", studentId, planId }])).rejects.toThrow(/Not allowed/);
  });

  it("disconnecting removes Junbi's webhook from the club's Stripe", async () => {
    calls.length = 0;
    await pay.disconnectPayments(c);
    expect(calls.some((x) => x.method === "DELETE" && x.path === "/v1/webhook_endpoints/we_own1")).toBe(true);
    expect((await pay.paymentSettings(c)).account).toBeNull();
  });
});

describe("dashboard and students summary", () => {
  it("counts students, attendance, absences and the weekly chart, for this club only", async () => {
    const opts = await studentsEdit.studentFormOptions(a);
    const siteId = opts.sites[0].id;
    const r = await studentsEdit.createStudent(a, {
      firstName: "Dash", lastName: "Board", siteId, status: "active", firstAidConsent: false, photoConsent: false,
      guardianFirstName: "Pat", guardianLastName: "Board", guardianEmail: "pat.board@example.test", relationship: "parent",
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const today = classes.todayISO();
    const weekday = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const c = await classes.createClass(a, { name: "Dashboard class", siteId, discipline: "taekwondo", weekday: String(weekday), startsAt: "00:00", durationMinutes: "60", capacity: "" });
    if (!c.ok) throw new Error(JSON.stringify(c.errors));
    await classes.setAttendance(a, c.value.id, today, r.value.id, true);

    for (const period of ["7d", "30d", "3m", "12m"]) {
      const s = await dash.dashboardStats(a, { period });
      expect(s.attendance).toBeGreaterThanOrEqual(1);
      expect(s.chart.length).toBe(dash.PERIODS[period as keyof typeof dash.PERIODS].buckets);
      expect(s.chart.reduce((x, b) => x + b.n, 0)).toBeGreaterThanOrEqual(1);
    }
    const s = await dash.dashboardStats(a, { siteId });
    expect(s.period).toBe("3m");
    expect(s.activeStudents).toBeGreaterThanOrEqual(1);
    expect(s.perClass).toBeGreaterThanOrEqual(1);
    expect(s.monthlyPence).not.toBeNull();
    expect(s.absent.find((x) => x.id === r.value.id)).toBeUndefined(); // joined today, and was in class

    // An instructor sees the numbers but not the money.
    expect((await dash.dashboardStats({ ...a, role: "instructor" })).monthlyPence).toBeNull();
    // A coach limited to another site sees none of this site's students.
    expect((await dash.dashboardStats({ ...a, role: "instructor", sites: [] })).activeStudents).toBe(0);
    // Another club sees none of it.
    const other = await dash.dashboardStats(b);
    expect(other.attendance).toBe(0);
    expect(other.activeStudents).toBe(0);

    const sum = await dash.studentsSummary(a);
    expect(sum.active).toBeGreaterThanOrEqual(1);
    expect(sum.recent.some((x) => x.id === r.value.id)).toBe(true);
    expect(sum.noPlan.length).toBeGreaterThanOrEqual(0);

    const prof = await students.getStudentProfile(a, r.value.id);
    expect(prof!.attendance.weeks).toHaveLength(12);
    expect(prof!.attendance.weeks.at(-1)!.n).toBe(1);
    expect(prof!.attendance.last).toBe(today);
  });
});

describe("Junbi admin", () => {
  it("only lets listed emails in, and lists every club with its fee and students", async () => {
    const { isSuperAdmin } = await import("@/auth/admin");
    const { clubFeeNow } = await import("@/lib/plans");
    process.env.SUPER_ADMIN_EMAILS = "Boss@Junbi.test, other@junbi.test";
    expect(isSuperAdmin("boss@junbi.test")).toBe(true);
    expect(isSuperAdmin("owner-a@example.test")).toBe(false);
    // First time in: the admin asks for a link, which makes a login with no club and no password yet.
    const link = await captureLink(() => flows.requestAdminSetup("boss@junbi.test"), "/reset-password");
    expect(link).toBeTruthy();
    const [boss] = await adminSql`select password_hash from users where email = 'boss@junbi.test'`;
    expect(boss.password_hash).toBeNull();
    expect((await accounts.checkLogin("boss@junbi.test", "")).ok).toBe(false);
    expect((await flows.resetPassword(link, "the admin's own long phrase")).ok).toBe(true);
    expect((await accounts.checkLogin("boss@junbi.test", "the admin's own long phrase")).ok).toBe(true);
    // Anyone not on the list gets nothing made for them.
    await flows.requestAdminSetup("stranger@junbi.test");
    expect(await adminSql`select 1 from users where email = 'stranger@junbi.test'`).toHaveLength(0);
    process.env.SUPER_ADMIN_EMAILS = "";
    expect(isSuperAdmin("boss@junbi.test")).toBe(false);

    // The cross-club list comes from one read-only function the app role can call.
    const rows = (await appSql`select * from admin_clubs()`) as unknown as Array<{ club_id: string; name: string; students_active: number; owner_email: string }>;
    const clubA = rows.find((r) => r.club_id === a.clubId)!;
    expect(clubA.owner_email).toBe("owner-a@example.test");
    expect(clubA.students_active).toBeGreaterThan(0);
    expect(rows.some((r) => r.club_id === b.clubId)).toBe(true);

    const t = "2026-10-12";
    expect(clubFeeNow({ plan: "club", founding: false, trialEndsOn: "2026-10-15", discountPercent: null, discountMonths: null }, t)).toMatchObject({ status: "trial", pence: 0 });
    expect(clubFeeNow({ plan: "club", founding: false, trialEndsOn: "2026-09-01", discountPercent: null, discountMonths: null }, t)).toMatchObject({ status: "paying", pence: 3900 });
    expect(clubFeeNow({ plan: "club", founding: true, trialEndsOn: "2026-09-01", discountPercent: null, discountMonths: null }, t)).toMatchObject({ status: "paying", pence: 1950 });
    expect(clubFeeNow({ plan: "club", founding: true, trialEndsOn: "2025-09-01", discountPercent: null, discountMonths: null }, t)).toMatchObject({ pence: 3900 });
    expect(clubFeeNow({ plan: "starter", founding: false, trialEndsOn: "2026-09-01", discountPercent: 100, discountMonths: null }, t)).toMatchObject({ status: "free", pence: 0 });
  });
});
