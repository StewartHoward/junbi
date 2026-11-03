import "server-only";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, canAtSite, ForbiddenError, type Actor } from "@/auth/permissions";
import type { FieldErrors, Result } from "./accounts";
import { convertLeads } from "./leads";
import { isRealDate } from "@/lib/dates";
import { todayISO } from "./classes";

const uuid = z.string().uuid();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isRealDate(v), "Use a valid date.")
  .nullable()
  .optional();

function errorsOf(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const studentFields = {
  firstName: z.string().trim().min(1, "Enter a first name.").max(80),
  lastName: z.string().trim().min(1, "Enter a last name.").max(80),
  dateOfBirth: optDate,
  siteId: uuid,
  status: z.enum(["trial", "active", "paused", "frozen", "cancelled", "pending"]),
  medicalNotes: optText(2000),
  firstAidConsent: z.boolean(),
  photoConsent: z.boolean(),
};

export const newStudentSchema = z
  .object({
    ...studentFields,
    householdId: uuid.optional().or(z.literal("").transform(() => undefined)),
    startingGradeId: uuid.optional().or(z.literal("").transform(() => undefined)),
    guardianFirstName: optText(80),
    guardianLastName: optText(80),
    guardianEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email.")
      .nullable()
      .optional(),
    guardianPhone: optText(40),
    relationship: z.enum(["parent", "guardian", "self", "other"]).catch("parent"),
  })
  .superRefine((d, ctx) => {
    if (!d.householdId && !d.guardianFirstName) {
      ctx.addIssue({ code: "custom", path: ["guardianFirstName"], message: "Add a contact. For adults, enter the student's own details." });
    }
  });

export type NewStudentInput = z.input<typeof newStudentSchema>;

async function assertSite(tx: Tx, actor: Actor, siteId: string) {
  const [site] = await tx.select({ id: s.sites.id }).from(s.sites).where(eq(s.sites.id, siteId));
  if (!site || !canAtSite(actor, "students.edit", siteId)) throw new ForbiddenError("students.edit");
}

export async function createStudent(actor: Actor, input: NewStudentInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "students.edit");
  const parsed = newStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error) };
  const d = parsed.data;

  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await assertSite(tx, actor, d.siteId);

    let householdId = d.householdId;
    if (householdId) {
      const [h] = await tx.select({ id: s.households.id }).from(s.households).where(eq(s.households.id, householdId));
      if (!h) return { ok: false as const, errors: { form: "That family no longer exists." } };
      // Staff limited to some sites can only add to families they can already see.
      if (actor.sites !== "all") {
        const members = await tx.select({ siteId: s.students.siteId }).from(s.students).where(eq(s.students.householdId, householdId));
        if (members.length && !members.some((m) => actor.sites.includes(m.siteId))) return { ok: false as const, errors: { form: "That family no longer exists." } };
      }
    } else {
      const surname = d.guardianLastName || d.lastName;
      const [h] = await tx.insert(s.households).values({ clubId: actor.clubId, name: `${surname} family` }).returning({ id: s.households.id });
      householdId = h.id;
      await tx.insert(s.guardians).values({
        clubId: actor.clubId,
        householdId,
        firstName: d.guardianFirstName!,
        lastName: d.guardianLastName || d.lastName,
        email: d.guardianEmail ?? null,
        phone: d.guardianPhone ?? null,
        relationship: d.relationship,
        isPayer: true,
      });
    }

    const [st] = await tx
      .insert(s.students)
      .values({
        clubId: actor.clubId,
        householdId,
        siteId: d.siteId,
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: d.dateOfBirth ?? null,
        status: d.status,
        medicalNotes: d.medicalNotes ?? null,
        firstAidConsent: d.firstAidConsent,
        photoConsent: d.photoConsent,
      })
      .returning({ id: s.students.id, joinedOn: s.students.joinedOn });

    // Rank is always derived from grading results, so a starting grade is recorded as one.
    if (d.startingGradeId) {
      const [g] = await tx.select({ id: s.grades.id }).from(s.grades).where(eq(s.grades.id, d.startingGradeId));
      if (g) {
        await tx.insert(s.gradingResults).values({
          clubId: actor.clubId,
          studentId: st.id,
          gradeId: g.id,
          gradedOn: st.joinedOn,
          outcome: "pass",
          examiner: "Grade on joining Junbi",
        });
      }
    }
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "student", entityId: st.id });
    // A new family that was a lead: mark the lead converted.
    if (!d.householdId) await convertLeads(tx, actor.clubId, { email: d.guardianEmail, phone: d.guardianPhone, studentId: st.id });
    return { ok: true as const, value: { id: st.id } };
  });
}

export const editStudentSchema = z.object({
  ...studentFields,
  licenceNumber: optText(60),
  licenceExpiresOn: optDate,
});
export type EditStudentInput = z.input<typeof editStudentSchema>;

export async function updateStudent(actor: Actor, id: string, input: EditStudentInput): Promise<Result> {
  assertCan(actor, "students.edit");
  if (!uuid.safeParse(id).success) throw new ForbiddenError("students.edit");
  const parsed = editStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error) };
  const d = parsed.data;

  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [before] = await tx.select().from(s.students).where(eq(s.students.id, id));
    if (!before) throw new ForbiddenError("students.edit");
    await assertSite(tx, actor, before.siteId);
    await assertSite(tx, actor, d.siteId);
    await tx
      .update(s.students)
      .set({
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: d.dateOfBirth ?? null,
        siteId: d.siteId,
        // Archiving and restoring have their own buttons, so editing never un-archives by accident.
        status: before.status === "archived" ? "archived" : d.status,
        medicalNotes: d.medicalNotes ?? null,
        firstAidConsent: d.firstAidConsent,
        photoConsent: d.photoConsent,
        licenceNumber: d.licenceNumber ?? null,
        licenceExpiresOn: d.licenceExpiresOn ?? null,
      })
      .where(eq(s.students.id, id));
    await tx.insert(s.auditLog).values({
      clubId: actor.clubId,
      actorUserId: actor.userId,
      action: "update",
      entity: "student",
      entityId: id,
      before: { status: before.status, siteId: before.siteId },
      after: { status: d.status, siteId: d.siteId },
    });
    return { ok: true as const, value: undefined };
  });
}

/** What the add/edit student forms need. */
export async function studentFormOptions(actor: Actor, opts: { householdId?: string; studentId?: string } = {}) {
  assertCan(actor, "students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const sites = (await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name))).filter(
      (x) => actor.sites === "all" || actor.sites.includes(x.id),
    );
    // Belts in every art the club has switched on, grouped by art for the form.
    const grades = await tx
      .select({ id: s.grades.id, name: s.grades.name, discipline: s.grades.discipline })
      .from(s.grades)
      .innerJoin(s.clubDisciplines, and(eq(s.clubDisciplines.discipline, s.grades.discipline), eq(s.clubDisciplines.active, true)))
      .orderBy(asc(s.clubDisciplines.createdAt), asc(s.grades.sortOrder));

    let household: { id: string; name: string } | null = null;
    if (opts.householdId && uuid.safeParse(opts.householdId).success) {
      const [h] = await tx.select({ id: s.households.id, name: s.households.name }).from(s.households).where(eq(s.households.id, opts.householdId));
      household = h ?? null;
    }

    let student: typeof s.students.$inferSelect | null = null;
    if (opts.studentId && uuid.safeParse(opts.studentId).success) {
      const [st] = await tx.select().from(s.students).where(and(eq(s.students.id, opts.studentId)));
      student = st ?? null;
      if (student && !canAtSite(actor, "students.edit", student.siteId)) student = null;
    }
    return { sites, grades, household, student };
  });
}

/**
 * Record a student's belt in any of the club's arts (a passing grading result), e.g. after a grading
 * or when someone starts a second art. Rank is always derived from these results.
 */
export async function recordBelt(actor: Actor, studentId: string, input: { gradeId: string; gradedOn: string }): Promise<Result> {
  assertCan(actor, "grading.record");
  const parsed = z
    .object({ gradeId: uuid, gradedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.") })
    .safeParse(input);
  if (!parsed.success || !uuid.safeParse(studentId).success) return { ok: false, errors: { gradeId: "Choose a belt." } };
  const d = parsed.data;
  if (d.gradedOn > todayISO()) return { ok: false, errors: { gradedOn: "The date can't be in the future." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select({ siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || !canAtSite(actor, "grading.record", st.siteId)) throw new ForbiddenError("grading.record");
    const [g] = await tx.select({ id: s.grades.id }).from(s.grades).where(eq(s.grades.id, d.gradeId));
    if (!g) return { ok: false as const, errors: { gradeId: "Choose a belt." } };
    await tx.insert(s.gradingResults).values({ clubId: actor.clubId, studentId, gradeId: g.id, gradedOn: d.gradedOn, outcome: "pass" });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "grading_result", entityId: studentId, after: { gradeId: g.id, gradedOn: d.gradedOn } });
    return { ok: true as const, value: undefined };
  });
}


/* ---------- Family contact details ---------- */

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const guardianEdit = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1, "Enter their first name.").max(80),
  lastName: z.string().trim().max(80).optional().transform((v) => v ?? ""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address."),
  phone: opt(40),
});
export const familyContactSchema = z.object({
  guardians: z.array(guardianEdit).max(6),
  addressLine1: opt(120),
  addressLine2: opt(120),
  town: opt(80),
  postcode: opt(12).transform((v) => (v ? v.toUpperCase() : null)),
  emergencyName: opt(80),
  emergencyPhone: opt(40),
});
export type FamilyContactInput = z.input<typeof familyContactSchema>;

/** Updates a family's parent contact details, home address and emergency contact from a student's profile. */
export async function updateFamilyContact(actor: Actor, studentId: string, input: FamilyContactInput): Promise<Result> {
  assertCan(actor, "students.edit");
  if (!z.string().uuid().safeParse(studentId).success) return { ok: false, errors: { form: "Student not found." } };
  const parsed = familyContactSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select({ householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || (actor.sites !== "all" && !actor.sites.includes(st.siteId))) return { ok: false as const, errors: { form: "Student not found." } };
    await tx
      .update(s.households)
      .set({ addressLine1: d.addressLine1, addressLine2: d.addressLine2, town: d.town, postcode: d.postcode, emergencyName: d.emergencyName, emergencyPhone: d.emergencyPhone })
      .where(eq(s.households.id, st.householdId));
    for (const g of d.guardians) {
      await tx
        .update(s.guardians)
        .set({ firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone })
        .where(and(eq(s.guardians.id, g.id), eq(s.guardians.householdId, st.householdId)));
    }
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "household_contact", entityId: st.householdId });
    return { ok: true as const, value: undefined };
  });
}

/* ---------- Archive and delete ---------- */

/** Active memberships still being paid through Stripe or GoCardless. These must be cancelled there first. */
async function livePayments(tx: Tx, studentId: string) {
  return tx
    .select({ id: s.memberships.id })
    .from(s.memberships)
    .where(and(eq(s.memberships.studentId, studentId), ne(s.memberships.status, "cancelled"), isNotNull(s.memberships.providerSubscriptionId)));
}

const PAYING = "still pays by Direct Debit or card. Cancel their membership in your Stripe or GoCardless dashboard first (Junbi updates by itself), then try again. Cancelling here could stop their brothers' and sisters' payments too.";

/** Hides a student who has left: off lists, registers and messages, with their history kept. Any plan without online payments ends today. */
export async function archiveStudent(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "students.edit");
  if (!uuid.safeParse(id).success) throw new ForbiddenError("students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select().from(s.students).where(eq(s.students.id, id));
    if (!st) throw new ForbiddenError("students.edit");
    await assertSite(tx, actor, st.siteId);
    if (st.status === "archived") return { ok: true as const, value: undefined };
    if ((await livePayments(tx, id)).length) return { ok: false as const, errors: { form: `${st.firstName} ${PAYING}` } };
    await tx.update(s.memberships).set({ status: "cancelled", endsOn: todayISO() }).where(and(eq(s.memberships.studentId, id), ne(s.memberships.status, "cancelled")));
    await tx.update(s.students).set({ status: "archived", archivedAt: new Date(), archivedFrom: st.status }).where(eq(s.students.id, id));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "archive", entity: "student", entityId: id, before: { status: st.status } });
    return { ok: true as const, value: undefined };
  });
}

/** Brings an archived student back, with the status they had before. */
export async function restoreStudent(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "students.edit");
  if (!uuid.safeParse(id).success) throw new ForbiddenError("students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select().from(s.students).where(eq(s.students.id, id));
    if (!st) throw new ForbiddenError("students.edit");
    await assertSite(tx, actor, st.siteId);
    if (st.status !== "archived") return { ok: true as const, value: undefined };
    const back = (["trial", "active", "paused", "frozen", "cancelled", "pending"] as const).find((x) => x === st.archivedFrom) ?? "cancelled";
    await tx.update(s.students).set({ status: back, archivedAt: null, archivedFrom: null }).where(eq(s.students.id, id));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "restore", entity: "student", entityId: id, after: { status: back } });
    return { ok: true as const, value: undefined };
  });
}

/**
 * Deletes a student for good: their attendance, belts, memberships and bookings go too. Owners and admins only,
 * and they type the student's name to confirm. Their family record goes as well when nobody else is in it and
 * it has no payment history.
 */
export async function deleteStudent(actor: Actor, id: string, confirmName: string): Promise<Result> {
  assertCan(actor, "payments.manage");
  if (!uuid.safeParse(id).success) throw new ForbiddenError("payments.manage");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select().from(s.students).where(eq(s.students.id, id));
    if (!st) throw new ForbiddenError("payments.manage");
    await assertSite(tx, actor, st.siteId);
    const name = `${st.firstName} ${st.lastName}`.trim();
    if (confirmName.trim().toLowerCase().replace(/\s+/g, " ") !== name.toLowerCase().replace(/\s+/g, " ")) {
      return { ok: false as const, errors: { confirm: `Type ${name} exactly to confirm.` } };
    }
    if ((await livePayments(tx, id)).length) return { ok: false as const, errors: { form: `${st.firstName} ${PAYING}` } };
    await tx.delete(s.students).where(eq(s.students.id, id));
    const [left] = (await tx.execute(sql`
      select (select count(*)::int from students where household_id = ${st.householdId}) as students,
             (select count(*)::int from payments where household_id = ${st.householdId}) as payments,
             (select count(*)::int from mandates where household_id = ${st.householdId}) as mandates`)) as unknown as Array<{ students: number; payments: number; mandates: number }>;
    if (left && left.students === 0 && left.payments === 0 && left.mandates === 0) await tx.delete(s.households).where(eq(s.households.id, st.householdId));
    // No name kept: the point of deleting is that their details are gone.
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "delete", entity: "student", entityId: id });
    return { ok: true as const, value: undefined };
  });
}
