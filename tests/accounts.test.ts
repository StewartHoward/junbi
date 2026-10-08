import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const { hashPassword, verifyPassword, passwordProblem } = await import("@/auth/password");
type Actor = import("@/auth/permissions").Actor;

const owner = (userId: string, clubId: string): Actor => ({ userId, clubId, role: "owner", sites: "all" });

async function signUp(email: string, clubName: string) {
  const r = await accounts.createClubAccount({ clubName, name: "Sam Owner", email, password: "a long enough phrase", plan: "pro", founding: true, terms: true });
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
  it("creates the club with a 30-day trial and the person as owner", async () => {
    const rows = await adminSql`select c.name, c.founding, c.trial_ends_on, cs.role, u.password_hash
      from clubs c join club_staff cs on cs.club_id = c.id join users u on u.id = cs.user_id where c.id = ${a.clubId}`;
    expect(rows[0]).toMatchObject({ name: "Club A Taekwondo", founding: true, role: "owner" });
    expect(rows[0].trial_ends_on).not.toBeNull();
    expect(String(rows[0].password_hash)).toMatch(/^scrypt\$/);
  });
  it("refuses a second account with the same email, any capitalisation", async () => {
    const r = await accounts.createClubAccount({ clubName: "Copy", name: "Xavier", email: "OWNER-A@example.test", password: "a long enough phrase", plan: "pro", founding: false, terms: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.email).toMatch(/already an account/);
    const [{ n }] = await adminSql`select count(*)::int as n from clubs where name = 'Copy'`;
    expect(n).toBe(0);
  });
  it("needs the terms ticked and a decent password", async () => {
    const r = await accounts.createClubAccount({ clubName: "Club C", name: "Y", email: "c@example.test", password: "short", plan: "pro", founding: false, terms: false });
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
  it("sets up arts, first site and the WT belt ladder, ignoring coming-soon arts", async () => {
    const r = await accounts.completeSetup(a, { disciplines: ["taekwondo", "judo"], interest: ["karate"], siteName: "Southport", siteAddress: "", syllabus: "wt" });
    expect(r.ok).toBe(true);
    const o = await club.getClubOverview(a);
    expect(o.activeArts).toEqual(["taekwondo"]);
    expect(o.interestArts).toEqual(["karate"]);
    expect(o.sites.map((s) => s.name)).toEqual(["Southport"]);
    expect(o.club.onboardedAt).not.toBeNull();
    const [{ n }] = await adminSql`select count(*)::int as n from grades where club_id = ${a.clubId} and discipline = 'taekwondo'`;
    expect(n).toBe(14);
  });
  it("requires at least one art", async () => {
    const r = await accounts.completeSetup(b, { disciplines: [], interest: ["judo"], siteName: "Preston", syllabus: "itf" });
    expect(!r.ok && r.errors.disciplines).toMatch(/at least one/);
  });
  it("lets the owner switch between Essentials and Pro, and nobody else", async () => {
    expect((await club.setPlan(a, "essentials")).ok).toBe(true);
    expect((await club.getClubOverview(a)).club.plan).toBe("essentials");
    expect((await club.setPlan(a, "association")).ok).toBe(false);
    await expect(club.setPlan({ ...a, role: "admin" }, "pro")).rejects.toThrow(/Not allowed/);
    await club.setPlan(a, "pro");
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
    expect(list[0].grade?.name).toBe("8th Kup");
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
    await accounts.completeSetup(b, { disciplines: ["taekwondo"], siteName: "Preston", syllabus: "itf" });
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
