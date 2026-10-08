import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, canAtSite, ForbiddenError, type Actor } from "@/auth/permissions";
import type { FieldErrors, Result } from "./accounts";

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
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Use a valid date.")
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
  status: z.enum(["trial", "active", "paused", "frozen", "cancelled"]),
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
        status: d.status,
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
  if (d.gradedOn > new Date().toISOString().slice(0, 10)) return { ok: false, errors: { gradedOn: "The date can't be in the future." } };
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
