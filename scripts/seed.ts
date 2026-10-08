import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/auth/password";

/**
 * LOCAL DEVELOPMENT ONLY: one sample club with two sites, staff for each role,
 * families, a WT kup/dan ladder, grading history, classes, attendance and payments.
 * Wipes existing data first, so it refuses to run against anything but localhost.
 * Every sample login uses the password in LOCAL_PASSWORD below.
 */

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_ADMIN_URL ?? "")) {
  throw new Error("The seed wipes the database, so it only runs against a local database.");
}
const LOCAL_PASSWORD = "local-dev-only-pass";
const url = process.env.DATABASE_ADMIN_URL;
if (!url) throw new Error("DATABASE_ADMIN_URL is not set");

const client = postgres(url, { max: 1, onnotice: () => {}, prepare: false });
const db = drizzle(client, { schema: s });

const LADDER: Array<[string, "kup" | "poom" | "dan", string]> = [
  ["10th Kup", "kup", "white"],
  ["9th Kup", "kup", "yellow"],
  ["8th Kup", "kup", "yellow"],
  ["7th Kup", "kup", "green"],
  ["6th Kup", "kup", "green"],
  ["5th Kup", "kup", "blue"],
  ["4th Kup", "kup", "blue"],
  ["3rd Kup", "kup", "red"],
  ["2nd Kup", "kup", "red"],
  ["1st Kup", "kup", "red"],
  ["1st Poom", "poom", "black"],
  ["1st Dan", "dan", "black"],
];

type StudentSeed = {
  first: string;
  last: string;
  dob: string;
  site: "southport" | "preston";
  status: (typeof s.studentStatus.enumValues)[number];
  /** Grades passed in order, each with a date. */
  history: Array<[string, string, (typeof s.gradingOutcome.enumValues)[number]?]>;
  medical?: string;
  attendance: number; // 0..1, share of sessions attended since the last grading
};

const FAMILIES: Array<{ name: string; guardians: Array<[string, string, string, boolean]>; kids: StudentSeed[]; payment: "paid" | "retrying" | "failed" | "cancelled" }> = [
  {
    name: "Taylor",
    guardians: [
      ["Sarah", "Taylor", "sarah.taylor@example.com", true],
      ["Mark", "Taylor", "mark.taylor@example.com", false],
    ],
    payment: "paid",
    kids: [
      {
        first: "Oliver", last: "Taylor", dob: "2015-04-12", site: "southport", status: "active",
        history: [["9th Kup", "2025-06-08"], ["8th Kup", "2025-10-12"], ["7th Kup", "2026-02-22"], ["6th Kup", "2026-06-14", "merit"]],
        medical: "Mild asthma. Inhaler kept in kit bag.", attendance: 0.9,
      },
      {
        first: "Grace", last: "Taylor", dob: "2019-09-30", site: "southport", status: "active",
        history: [["9th Kup", "2026-06-14"]], attendance: 0.45,
      },
    ],
  },
  { name: "Ahmed", guardians: [["Yusuf", "Ahmed", "yusuf.ahmed@example.com", true]], payment: "paid", kids: [
    { first: "Amelia", last: "Ahmed", dob: "2016-01-20", site: "southport", status: "active", history: [["9th Kup", "2026-02-22"], ["8th Kup", "2026-06-14"]], attendance: 0.8 },
  ] },
  { name: "Khan", guardians: [["Priya", "Khan", "priya.khan@example.com", true]], payment: "paid", kids: [
    { first: "Maya", last: "Khan", dob: "2014-07-03", site: "southport", status: "active", history: [["7th Kup", "2025-06-08"], ["6th Kup", "2025-10-12"], ["5th Kup", "2026-02-22"], ["4th Kup", "2026-06-14"]], medical: "Mild asthma.", attendance: 0.6 },
  ] },
  { name: "Patel", guardians: [["Anil", "Patel", "anil.patel@example.com", true]], payment: "retrying", kids: [
    { first: "Noah", last: "Patel", dob: "2012-11-11", site: "southport", status: "active", history: [["4th Kup", "2025-10-12"], ["3rd Kup", "2026-02-22"], ["2nd Kup", "2026-06-14"]], attendance: 0.85 },
  ] },
  { name: "Evans", guardians: [["Laura", "Evans", "laura.evans@example.com", true]], payment: "cancelled", kids: [
    { first: "Leo", last: "Evans", dob: "2015-10-07", site: "southport", status: "active", history: [["8th Kup", "2026-02-22"], ["7th Kup", "2026-06-14"]], attendance: 0.7 },
    { first: "Isla", last: "Evans", dob: "2013-03-15", site: "southport", status: "active", history: [["6th Kup", "2026-02-22"], ["5th Kup", "2026-06-14"]], attendance: 0.3 },
  ] },
  { name: "Shah", guardians: [["Ryan", "Shah", "ryan.shah@example.com", true]], payment: "failed", kids: [
    { first: "Ryan", last: "Shah", dob: "1990-05-05", site: "preston", status: "active", history: [["1st Kup", "2025-10-12"], ["1st Dan", "2026-06-14", "distinction"]], attendance: 0.75 },
  ] },
  { name: "Morris", guardians: [["Jack", "Morris", "jack.morris@example.com", true]], payment: "retrying", kids: [
    { first: "Jack", last: "Morris", dob: "1987-02-14", site: "preston", status: "active", history: [["5th Kup", "2026-02-22"], ["4th Kup", "2026-06-14"]], attendance: 0.5 },
  ] },
  { name: "Hughes", guardians: [["Ella", "Hughes", "ella.hughes@example.com", true]], payment: "paid", kids: [
    { first: "Ella", last: "Hughes", dob: "1995-08-21", site: "preston", status: "active", history: [["3rd Kup", "2026-06-14"]], attendance: 0.65 },
  ] },
  { name: "Lewis", guardians: [["Tom", "Lewis", "tom.lewis@example.com", true]], payment: "paid", kids: [
    { first: "Freddie", last: "Lewis", dob: "2017-12-01", site: "southport", status: "trial", history: [], attendance: 0.2 },
  ] },
  { name: "Hassan", guardians: [["Omar", "Hassan", "omar.hassan@example.com", true]], payment: "paid", kids: [
    { first: "Zara", last: "Hassan", dob: "2018-06-18", site: "southport", status: "active", history: [], attendance: 0.6 },
  ] },
];

const STAFF: Array<[string, string, (typeof s.staffRole.enumValues)[number], "all" | Array<"southport" | "preston">]> = [
  ["owner@junbi.test", "Club Owner", "owner", "all"],
  ["admin@junbi.test", "Office Admin", "admin", "all"],
  ["instructor@junbi.test", "Southport Instructor", "instructor", ["southport"]],
  ["assistant@junbi.test", "Southport Assistant", "assistant", ["southport"]],
];

const PLAN_PRICES = { junior: 3500, adult: 3900, family: 5600, tots: 2400 };

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const tables = ["auth_sessions", "auth_failures", "club_disciplines", "audit_log", "attendance", "class_sessions", "classes", "payments", "mandates", "memberships", "plans",
    "grading_results", "grades", "students", "guardians", "households", "staff_sites", "club_staff", "sites", "clubs", "users"];
  await client.unsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);

  const [club] = await db.insert(s.clubs).values({ name: "Sample Taekwondo Club", slug: "sample", plan: "pro", onboardedAt: new Date() }).returning();
  const clubId = club.id;
  await db.insert(s.clubDisciplines).values({ clubId, discipline: "taekwondo", active: true });
  const passwordHash = await hashPassword(LOCAL_PASSWORD);
  const [southport, preston] = await db
    .insert(s.sites)
    .values([
      { clubId, name: "Southport", address: "Southport" },
      { clubId, name: "Preston", address: "Preston" },
    ])
    .returning();
  const siteIds = { southport: southport.id, preston: preston.id };

  for (const [email, name, role, sites] of STAFF) {
    const [user] = await db.insert(s.users).values({ email, name, passwordHash }).returning();
    const [staff] = await db
      .insert(s.clubStaff)
      .values({ clubId, userId: user.id, role, allSites: sites === "all" })
      .returning();
    if (sites !== "all") {
      await db.insert(s.staffSites).values(sites.map((k) => ({ clubId, staffId: staff.id, siteId: siteIds[k] })));
    }
  }

  const grades = await db
    .insert(s.grades)
    .values(LADDER.map(([name, kind, beltColour], i) => ({ clubId, name, kind, beltColour, sortOrder: i, classesRequired: 20 })))
    .returning();
  const gradeByName = new Map(grades.map((g) => [g.name, g]));

  const [junior, adult, family] = await db
    .insert(s.plans)
    .values([
      { clubId, name: "Junior monthly", amountPence: PLAN_PRICES.junior },
      { clubId, name: "Adult monthly", amountPence: PLAN_PRICES.adult },
      { clubId, name: "Family, 2 children", amountPence: PLAN_PRICES.family },
      { clubId, name: "Tots", amountPence: PLAN_PRICES.tots },
    ])
    .returning();

  // Classes and a session every week since mid-June.
  const classRows = await db
    .insert(s.classes)
    .values([
      { clubId, siteId: southport.id, name: "Juniors, kup grades", weekday: 2, startsAt: "17:45", capacity: 30 },
      { clubId, siteId: southport.id, name: "Juniors, kup grades", weekday: 4, startsAt: "17:45", capacity: 30 },
      { clubId, siteId: preston.id, name: "Adults and black belts", weekday: 4, startsAt: "19:00", capacity: 30 },
    ])
    .returning();

  const sessionsBySite: Record<string, Array<{ id: string; date: string }>> = { [southport.id]: [], [preston.id]: [] };
  for (const cls of classRows) {
    // 2026-06-15 is a Monday; weekday 1 = Monday.
    for (let date = addDays("2026-06-15", cls.weekday - 1); date <= "2026-10-07"; date = addDays(date, 7)) {
      const [row] = await db
        .insert(s.sessions)
        .values({ clubId, classId: cls.id, startsAt: new Date(`${date}T${cls.startsAt.slice(0, 5)}:00+01:00`) })
        .returning();
      sessionsBySite[cls.siteId].push({ id: row.id, date });
    }
  }

  let seq = 0;
  for (const fam of FAMILIES) {
    const [hh] = await db.insert(s.households).values({ clubId, name: `${fam.name} household` }).returning();
    await db.insert(s.guardians).values(
      fam.guardians.map(([firstName, lastName, email, isPayer]) => ({
        clubId, householdId: hh.id, firstName, lastName, email, isPayer, relationship: isPayer ? "parent, payer" : "parent",
      })),
    );

    const mandateStatus = fam.payment === "cancelled" ? "cancelled" : "active";
    const [mandate] = await db
      .insert(s.mandates)
      .values({ clubId, householdId: hh.id, status: mandateStatus, providerMandateId: `MD_SAMPLE_${fam.name.toUpperCase()}` })
      .returning();

    let householdTotal = 0;
    for (const kid of fam.kids) {
      const [student] = await db
        .insert(s.students)
        .values({
          clubId, householdId: hh.id, siteId: siteIds[kid.site], firstName: kid.first, lastName: kid.last,
          dateOfBirth: kid.dob, status: kid.status, joinedOn: kid.history[0]?.[1] ?? "2026-09-01",
          medicalNotes: kid.medical ?? null, firstAidConsent: true, photoConsent: true,
          licenceNumber: kid.status === "trial" ? null : `LIC-${1000 + seq}`,
          licenceExpiresOn: kid.status === "trial" ? null : seq % 4 === 0 ? "2026-10-31" : "2027-03-31",
        })
        .returning();
      seq++;

      for (const [gradeName, gradedOn, outcome] of kid.history) {
        await db.insert(s.gradingResults).values({
          clubId, studentId: student.id, gradeId: gradeByName.get(gradeName)!.id, gradedOn, outcome: outcome ?? "pass", examiner: "Head instructor",
        });
      }

      const isAdult = Number(kid.dob.slice(0, 4)) < 2008;
      const plan = fam.kids.length > 1 ? family : isAdult ? adult : junior;
      await db.insert(s.memberships).values({ clubId, studentId: student.id, planId: plan.id, startsOn: kid.history[0]?.[1] ?? "2026-09-01" });
      householdTotal = fam.kids.length > 1 ? family.amountPence : householdTotal + plan.amountPence;

      // Deterministic attendance since the last grading.
      const since = kid.history.at(-1)?.[1] ?? "2026-09-01";
      const eligible = sessionsBySite[siteIds[kid.site]].filter((x) => x.date > since);
      const keep = Math.round(eligible.length * kid.attendance);
      const attended = eligible.slice(0, keep);
      if (attended.length) {
        await db.insert(s.attendance).values(
          attended.map((x, i) => ({ clubId, sessionId: x.id, studentId: student.id, method: i % 3 === 0 ? ("kiosk" as const) : ("register" as const) })),
        );
      }
    }

    const octStatus = { paid: "confirmed", retrying: "retrying", failed: "failed", cancelled: "failed" } as const;
    await db.insert(s.payments).values([
      { clubId, householdId: hh.id, mandateId: mandate.id, description: "September membership", amountPence: householdTotal, chargeDate: "2026-09-01", status: "paid_out" },
      { clubId, householdId: hh.id, mandateId: mandate.id, description: "October membership", amountPence: householdTotal, chargeDate: "2026-10-01", status: octStatus[fam.payment], retryCount: fam.payment === "paid" ? 0 : fam.payment === "retrying" ? 1 : 2 },
    ]);
  }

  console.log(`Seeded "${club.name}" with ${seq} students. Staff logins (password "${LOCAL_PASSWORD}"): ${STAFF.map((x) => x[0]).join(", ")}`);
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
