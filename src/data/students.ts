import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, can, canAtSite, paymentNoticeFor, ForbiddenError, type Actor } from "@/auth/permissions";

export type Grade = { id: string; name: string; beltColour: string; sortOrder: number; classesRequired: number; discipline: string };
type Held = { grade: Grade; gradedOn: string };

/**
 * Current belt in each art = latest passing grading result for that art. Rank is derived, never typed in.
 * Returns studentId -> discipline -> belt.
 */
async function currentGradesByArt(tx: Tx, studentIds: string[]) {
  const out = new Map<string, Map<string, Held>>();
  if (!studentIds.length) return out;
  const rows = await tx
    .select({
      studentId: s.gradingResults.studentId,
      gradedOn: s.gradingResults.gradedOn,
      grade: {
        id: s.grades.id,
        name: s.grades.name,
        beltColour: s.grades.beltColour,
        sortOrder: s.grades.sortOrder,
        classesRequired: s.grades.classesRequired,
        discipline: s.grades.discipline,
      },
    })
    .from(s.gradingResults)
    .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
    .where(and(inArray(s.gradingResults.studentId, studentIds), ne(s.gradingResults.outcome, "fail")))
    .orderBy(asc(s.gradingResults.gradedOn), asc(s.grades.sortOrder));
  for (const r of rows) {
    const byArt = out.get(r.studentId) ?? new Map<string, Held>();
    byArt.set(r.grade.discipline, { grade: r.grade, gradedOn: r.gradedOn });
    out.set(r.studentId, byArt);
  }
  return out;
}

/** Club's active arts in set-up order, used to order belts consistently. */
async function clubArtOrder(tx: Tx) {
  const rows = await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)).orderBy(asc(s.clubDisciplines.createdAt));
  return rows.map((r) => r.d);
}

function sortedBelts(byArt: Map<string, Held> | undefined, order: string[]): Held[] {
  if (!byArt) return [];
  const rank = (d: string) => (order.indexOf(d) === -1 ? 99 : order.indexOf(d));
  return [...byArt.values()].sort((a, b) => rank(a.grade.discipline) - rank(b.grade.discipline));
}

/** Households with a payment that needs attention (failed, retrying, or a cancelled mandate). */
async function householdPaymentIssues(tx: Tx, householdIds: string[]) {
  const issues = new Map<string, string>();
  if (!householdIds.length) return issues;
  const cancelled = await tx
    .select({ householdId: s.mandates.householdId })
    .from(s.mandates)
    .where(and(inArray(s.mandates.householdId, householdIds), inArray(s.mandates.status, ["cancelled", "failed", "expired"])));
  // A family that has since set up a new Direct Debit isn't a problem any more.
  const working = new Set(
    (await tx
      .select({ householdId: s.mandates.householdId })
      .from(s.mandates)
      .where(and(inArray(s.mandates.householdId, householdIds), inArray(s.mandates.status, ["active", "submitted", "pending_submission"])))).map((m) => m.householdId),
  );
  for (const m of cancelled) if (!working.has(m.householdId)) issues.set(m.householdId, "Direct Debit cancelled");

  const late = await tx
    .select({ householdId: s.payments.householdId, status: s.payments.status, amountPence: s.payments.amountPence })
    .from(s.payments)
    .where(and(inArray(s.payments.householdId, householdIds), inArray(s.payments.status, ["failed", "retrying"])));
  for (const p of late) {
    const what = p.status === "failed" ? "Payment failed" : "Payment retrying";
    const prev = issues.get(p.householdId);
    issues.set(p.householdId, `${prev ? `${prev} · ` : ""}${what} · ${formatPence(p.amountPence)}`);
  }
  return issues;
}

export function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function siteFilter(actor: Actor) {
  return actor.sites === "all" ? undefined : inArray(s.students.siteId, [...actor.sites]);
}

export type StudentListItem = {
  id: string;
  name: string;
  status: string;
  site: string;
  /** Signed up through the family sign-up link in the last 14 days. */
  isNewSignup: boolean;
  /** One belt per art the student holds a grade in. Empty for new starters. */
  grades: Grade[];
  paymentNotice: string | null;
  firstName: string;
  lastName: string;
  createdAt: Date;
};

export const STUDENT_FILTERS = ["payment-problems", "no-dd", "new"] as const;
export type StudentListOptions = { q?: string; status?: string; siteId?: string; filter?: string };

export async function listStudents(actor: Actor, opts: StudentListOptions = {}): Promise<StudentListItem[]> {
  assertCan(actor, "students.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const q = opts.q?.trim();
    const status = (s.studentStatus.enumValues as readonly string[]).includes(opts.status ?? "") ? (opts.status as (typeof s.studentStatus.enumValues)[number]) : undefined;
    const siteId = opts.siteId && /^[0-9a-f-]{36}$/i.test(opts.siteId) ? opts.siteId : undefined;
    const money = opts.filter === "payment-problems" || opts.filter === "no-dd" ? can(actor, "payments.view") : true;
    const rows = await tx
      .select({
        id: s.students.id,
        firstName: s.students.firstName,
        lastName: s.students.lastName,
        status: s.students.status,
        householdId: s.students.householdId,
        site: s.sites.name,
        source: s.students.source,
        createdAt: s.students.createdAt,
      })
      .from(s.students)
      .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
      .where(
        and(
          siteFilter(actor),
          q ? or(ilike(s.students.firstName, `%${q}%`), ilike(s.students.lastName, `%${q}%`)) : undefined,
          status ? eq(s.students.status, status) : undefined,
          siteId ? eq(s.students.siteId, siteId) : undefined,
          opts.filter === "new" ? sql`${s.students.createdAt} > now() - interval '30 days'` : undefined,
          opts.filter === "no-dd" && money
            ? sql`${s.students.status} = 'active'
                and exists (select 1 from memberships m where m.student_id = ${s.students.id} and m.status = 'active')
                and not exists (select 1 from mandates d where d.household_id = ${s.students.householdId} and d.status in ('active', 'submitted', 'pending_submission'))`
            : undefined,
        ),
      )
      .orderBy(asc(s.students.lastName), asc(s.students.firstName));

    const grades = await currentGradesByArt(tx, rows.map((r) => r.id));
    const order = await clubArtOrder(tx);
    const issues = await householdPaymentIssues(tx, [...new Set(rows.map((r) => r.householdId))]);

    const shown = opts.filter === "payment-problems" ? (money ? rows.filter((r) => issues.has(r.householdId)) : []) : rows;
    return shown.map((r) => {
      const detail = issues.get(r.householdId);
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        status: r.status,
        site: r.site,
        isNewSignup: r.source === "join_link" && Date.now() - r.createdAt.getTime() < 14 * 86_400_000,
        grades: sortedBelts(grades.get(r.id), order).map((h) => h.grade),
        paymentNotice: paymentNoticeFor(actor, { hasIssue: Boolean(detail), detail: detail ?? "" }),
        firstName: r.firstName,
        lastName: r.lastName,
        createdAt: r.createdAt,
      };
    });
  });
}

export type StudentProfile = Awaited<ReturnType<typeof getStudentProfile>>;

export async function getStudentProfile(actor: Actor, studentId: string) {
  assertCan(actor, "students.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [row] = await tx
      .select({ student: s.students, site: s.sites })
      .from(s.students)
      .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
      .where(eq(s.students.id, studentId));
    if (!row) return null;
    if (!canAtSite(actor, "students.view", row.site.id)) throw new ForbiddenError("students.view");

    const st = row.student;
    const order = await clubArtOrder(tx);
    const held = sortedBelts((await currentGradesByArt(tx, [st.id])).get(st.id), order);

    // One belt journey per art the student holds a grade in.
    const belts = [];
    for (const h of held) {
      const ladder = await tx
        .select({ id: s.grades.id, name: s.grades.name, beltColour: s.grades.beltColour, sortOrder: s.grades.sortOrder })
        .from(s.grades)
        .where(eq(s.grades.discipline, h.grade.discipline))
        .orderBy(asc(s.grades.sortOrder));
      const next = ladder.find((g) => g.sortOrder > h.grade.sortOrder) ?? null;
      const [{ count: classesSince }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(s.attendance)
        .innerJoin(s.sessions, eq(s.sessions.id, s.attendance.sessionId))
        .innerJoin(s.classes, eq(s.classes.id, s.sessions.classId))
        .where(and(eq(s.attendance.studentId, st.id), eq(s.classes.discipline, h.grade.discipline), gt(s.sessions.startsAt, new Date(`${h.gradedOn}T23:59:59Z`))));
      belts.push({
        discipline: h.grade.discipline,
        current: h,
        ladder,
        next,
        classesSince,
        readyToGrade: Boolean(next && h.grade.classesRequired > 0 && classesSince >= h.grade.classesRequired),
      });
    }

    // Grades the student could be given, for the "update belt" form: every grade in the club's active arts.
    const gradeOptions = await tx
      .select({ id: s.grades.id, name: s.grades.name, discipline: s.grades.discipline, sortOrder: s.grades.sortOrder })
      .from(s.grades)
      .innerJoin(s.clubDisciplines, and(eq(s.clubDisciplines.discipline, s.grades.discipline), eq(s.clubDisciplines.active, true)))
      .orderBy(asc(s.grades.discipline), asc(s.grades.sortOrder));

    const history = await tx
      .select({ id: s.gradingResults.id, gradedOn: s.gradingResults.gradedOn, outcome: s.gradingResults.outcome, examiner: s.gradingResults.examiner, grade: s.grades.name, beltColour: s.grades.beltColour, discipline: s.grades.discipline })
      .from(s.gradingResults)
      .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
      .where(eq(s.gradingResults.studentId, st.id))
      .orderBy(desc(s.gradingResults.gradedOn));

    const guardians = await tx.select().from(s.guardians).where(eq(s.guardians.householdId, st.householdId)).orderBy(desc(s.guardians.isPayer), asc(s.guardians.createdAt));
    const [household] = await tx.select().from(s.households).where(eq(s.households.id, st.householdId));
    const siblingRows = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName })
      .from(s.students)
      .where(and(eq(s.students.householdId, st.householdId), ne(s.students.id, st.id)));
    const siblingGrades = await currentGradesByArt(tx, siblingRows.map((x) => x.id));
    const siblings = siblingRows.map((x) => ({ ...x, grade: sortedBelts(siblingGrades.get(x.id), order)[0]?.grade ?? null }));

    const memberships = await tx
      .select({ id: s.memberships.id, plan: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval, startsOn: s.memberships.startsOn })
      .from(s.memberships)
      .innerJoin(s.plans, eq(s.plans.id, s.memberships.planId))
      .where(and(eq(s.memberships.studentId, st.id), ne(s.memberships.status, "cancelled")))
      .orderBy(desc(s.memberships.startsOn));
    const [clubFee] = await tx.select({ fee: s.clubs.signupFeePence }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const planOptions = can(actor, "payments.manage")
      ? await tx.select({ id: s.plans.id, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval }).from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.amountPence))
      : [];

    const issueDetail = (await householdPaymentIssues(tx, [st.householdId])).get(st.householdId);

    // Classes each week for the last 12 weeks, for the attendance chart.
    const weeks = (await tx.execute(sql`
      select to_char(g, 'YYYY-MM-DD') as start, count(x.id)::int as n
      from generate_series(date_trunc('week', now() at time zone 'Europe/London') - interval '11 weeks', date_trunc('week', now() at time zone 'Europe/London'), interval '1 week') g
      left join (
        select a.id, cs.starts_at at time zone 'Europe/London' as at
        from attendance a join class_sessions cs on cs.id = a.session_id where a.student_id = ${st.id}
      ) x on x.at >= g and x.at < g + interval '1 week'
      group by g order by g`)) as unknown as Array<{ start: string; n: number }>;
    const [lastRow] = (await tx.execute(sql`
      select to_char(max(cs.starts_at at time zone 'Europe/London'), 'YYYY-MM-DD') as last
      from attendance a join class_sessions cs on cs.id = a.session_id where a.student_id = ${st.id}`)) as unknown as Array<{ last: string | null }>;

    let billing: null | {
      mandateStatus: string | null;
      payments: Array<{ id: string; chargeDate: string; description: string; amount: string; status: string }>;
    } = null;
    if (can(actor, "payments.view")) {
      // Show the working mandate if there is one, otherwise the newest.
      const [mandate] = await tx
        .select()
        .from(s.mandates)
        .where(eq(s.mandates.householdId, st.householdId))
        .orderBy(sql`case when ${s.mandates.status} in ('active', 'submitted', 'pending_submission') then 0 else 1 end`, desc(s.mandates.createdAt))
        .limit(1);
      const payments = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.householdId, st.householdId))
        .orderBy(desc(s.payments.chargeDate));
      billing = {
        mandateStatus: mandate?.status ?? null,
        payments: payments.map((p) => ({ id: p.id, chargeDate: p.chargeDate, description: p.description, amount: formatPence(p.amountPence), status: p.status })),
      };
    }

    return {
      id: st.id,
      householdId: st.householdId,
      name: `${st.firstName} ${st.lastName}`,
      initials: `${st.firstName[0]}${st.lastName[0]}`,
      status: st.status,
      site: row.site.name,
      dateOfBirth: st.dateOfBirth,
      joinedOn: st.joinedOn,
      licence: st.licenceNumber ? { number: st.licenceNumber, expiresOn: st.licenceExpiresOn } : null,
      medical: can(actor, "medical.view") ? { notes: st.medicalNotes, firstAidConsent: st.firstAidConsent } : null,
      belts,
      gradeOptions,
      history,
      guardians: guardians.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        name: `${g.firstName} ${g.lastName}`,
        relationship: g.relationship,
        isPayer: g.isPayer,
        // Contact details are only for staff who can see the full profile.
        email: can(actor, "students.edit") ? g.email : null,
        phone: can(actor, "students.edit") ? g.phone : null,
      })),
      contact: can(actor, "students.edit") && household
        ? {
            addressLine1: household.addressLine1,
            addressLine2: household.addressLine2,
            town: household.town,
            postcode: household.postcode,
            emergencyName: household.emergencyName,
            emergencyPhone: household.emergencyPhone,
          }
        : null,
      siblings,
      memberships: memberships.map((m) => ({
        id: m.id,
        plan: m.plan,
        price: can(actor, "payments.view") ? `${formatPence(m.amountPence)} ${m.interval === "annual" ? "a year" : m.interval === "termly" ? "a term" : "a month"}` : null,
        startsOn: m.startsOn,
      })),
      signupFee: clubFee?.fee && can(actor, "payments.view") ? formatPence(clubFee.fee) : null,
      planOptions: planOptions.map((p) => ({ id: p.id, label: `${p.name} · ${formatPence(p.amountPence)} ${p.interval === "annual" ? "a year" : p.interval === "termly" ? "a term" : "a month"}` })),
      paymentNotice: paymentNoticeFor(actor, { hasIssue: Boolean(issueDetail), detail: issueDetail ?? "" }),
      billing,
      attendance: { weeks, last: lastRow?.last ?? null },
    };
  });
}
