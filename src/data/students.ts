import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, can, canAtSite, paymentNoticeFor, ForbiddenError, type Actor } from "@/auth/permissions";

export type Grade = { id: string; name: string; beltColour: string; sortOrder: number; classesRequired: number };

/** Current grade = latest passing grading result. Rank is derived, never typed in. */
async function currentGrades(tx: Tx, studentIds: string[]) {
  const out = new Map<string, { grade: Grade; gradedOn: string }>();
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
      },
    })
    .from(s.gradingResults)
    .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
    .where(and(inArray(s.gradingResults.studentId, studentIds), ne(s.gradingResults.outcome, "fail")))
    .orderBy(asc(s.gradingResults.gradedOn), asc(s.grades.sortOrder));
  for (const r of rows) out.set(r.studentId, { grade: r.grade, gradedOn: r.gradedOn });
  return out;
}

/** Households with a payment that needs attention (failed, retrying, or a cancelled mandate). */
async function householdPaymentIssues(tx: Tx, householdIds: string[]) {
  const issues = new Map<string, string>();
  if (!householdIds.length) return issues;
  const cancelled = await tx
    .select({ householdId: s.mandates.householdId })
    .from(s.mandates)
    .where(and(inArray(s.mandates.householdId, householdIds), inArray(s.mandates.status, ["cancelled", "failed", "expired"])));
  for (const m of cancelled) issues.set(m.householdId, "Direct Debit cancelled");

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
  grade: Grade | null;
  paymentNotice: string | null;
};

export async function listStudents(actor: Actor, opts: { q?: string } = {}): Promise<StudentListItem[]> {
  assertCan(actor, "students.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const q = opts.q?.trim();
    const rows = await tx
      .select({
        id: s.students.id,
        firstName: s.students.firstName,
        lastName: s.students.lastName,
        status: s.students.status,
        householdId: s.students.householdId,
        site: s.sites.name,
      })
      .from(s.students)
      .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
      .where(
        and(
          siteFilter(actor),
          q ? or(ilike(s.students.firstName, `%${q}%`), ilike(s.students.lastName, `%${q}%`)) : undefined,
        ),
      )
      .orderBy(asc(s.students.lastName), asc(s.students.firstName));

    const grades = await currentGrades(tx, rows.map((r) => r.id));
    const issues = await householdPaymentIssues(tx, [...new Set(rows.map((r) => r.householdId))]);

    return rows.map((r) => {
      const detail = issues.get(r.householdId);
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        status: r.status,
        site: r.site,
        grade: grades.get(r.id)?.grade ?? null,
        paymentNotice: paymentNoticeFor(actor, { hasIssue: Boolean(detail), detail: detail ?? "" }),
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
    const ladder = await tx.select().from(s.grades).orderBy(asc(s.grades.sortOrder));
    const current = (await currentGrades(tx, [st.id])).get(st.id) ?? null;
    const next = ladder.find((g) => g.sortOrder === (current?.grade.sortOrder ?? -1) + 1) ?? null;

    const since = current?.gradedOn ?? st.joinedOn;
    const [{ count: classesSince }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(s.attendance)
      .innerJoin(s.sessions, eq(s.sessions.id, s.attendance.sessionId))
      .where(and(eq(s.attendance.studentId, st.id), gt(s.sessions.startsAt, new Date(`${since}T23:59:59Z`))));

    const history = await tx
      .select({ id: s.gradingResults.id, gradedOn: s.gradingResults.gradedOn, outcome: s.gradingResults.outcome, examiner: s.gradingResults.examiner, grade: s.grades.name, beltColour: s.grades.beltColour })
      .from(s.gradingResults)
      .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
      .where(eq(s.gradingResults.studentId, st.id))
      .orderBy(desc(s.gradingResults.gradedOn));

    const guardians = await tx.select().from(s.guardians).where(eq(s.guardians.householdId, st.householdId));
    const siblingRows = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName })
      .from(s.students)
      .where(and(eq(s.students.householdId, st.householdId), ne(s.students.id, st.id)));
    const siblingGrades = await currentGrades(tx, siblingRows.map((x) => x.id));
    const siblings = siblingRows.map((x) => ({ ...x, grade: siblingGrades.get(x.id)?.grade ?? null }));

    const [membership] = await tx
      .select({ plan: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval, startsOn: s.memberships.startsOn })
      .from(s.memberships)
      .innerJoin(s.plans, eq(s.plans.id, s.memberships.planId))
      .where(eq(s.memberships.studentId, st.id))
      .orderBy(desc(s.memberships.startsOn))
      .limit(1);

    const issueDetail = (await householdPaymentIssues(tx, [st.householdId])).get(st.householdId);

    let billing: null | {
      mandateStatus: string | null;
      payments: Array<{ id: string; chargeDate: string; description: string; amount: string; status: string }>;
    } = null;
    if (can(actor, "payments.view")) {
      const [mandate] = await tx.select().from(s.mandates).where(eq(s.mandates.householdId, st.householdId)).limit(1);
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
      name: `${st.firstName} ${st.lastName}`,
      initials: `${st.firstName[0]}${st.lastName[0]}`,
      status: st.status,
      site: row.site.name,
      dateOfBirth: st.dateOfBirth,
      joinedOn: st.joinedOn,
      licence: st.licenceNumber ? { number: st.licenceNumber, expiresOn: st.licenceExpiresOn } : null,
      medical: can(actor, "medical.view") ? { notes: st.medicalNotes, firstAidConsent: st.firstAidConsent } : null,
      ladder: ladder.map((g) => ({ id: g.id, name: g.name, beltColour: g.beltColour, sortOrder: g.sortOrder })),
      current,
      next,
      classesSince,
      readyToGrade: Boolean(next && current && classesSince >= current.grade.classesRequired),
      history,
      guardians: guardians.map((g) => ({
        id: g.id,
        name: `${g.firstName} ${g.lastName}`,
        relationship: g.relationship,
        // Contact details are only for staff who can see the full profile.
        email: can(actor, "students.edit") ? g.email : null,
      })),
      siblings,
      membership: membership
        ? { plan: membership.plan, price: can(actor, "payments.view") ? formatPence(membership.amountPence) : null, startsOn: membership.startsOn }
        : null,
      paymentNotice: paymentNoticeFor(actor, { hasIssue: Boolean(issueDetail), detail: issueDetail ?? "" }),
      billing,
    };
  });
}
