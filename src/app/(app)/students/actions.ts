"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { createStudent, updateStudent } from "@/data/student-edit";
import type { FieldErrors } from "@/data/accounts";

export type StudentFormState = { errors?: FieldErrors; values?: Record<string, string> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const values = (f: FormData) => {
  const v: Record<string, string> = {};
  for (const [k, val] of f.entries()) if (typeof val === "string" && !k.startsWith("$")) v[k] = val;
  return v;
};

export async function createStudentAction(_prev: StudentFormState, f: FormData): Promise<StudentFormState> {
  const actor = await requireActor();
  const r = await createStudent(actor, {
    firstName: str(f, "firstName"),
    lastName: str(f, "lastName"),
    dateOfBirth: str(f, "dateOfBirth"),
    siteId: str(f, "siteId"),
    status: str(f, "status") as never,
    medicalNotes: str(f, "medicalNotes"),
    firstAidConsent: f.get("firstAidConsent") === "on",
    photoConsent: f.get("photoConsent") === "on",
    householdId: str(f, "householdId"),
    startingGradeId: str(f, "startingGradeId"),
    guardianFirstName: str(f, "guardianFirstName"),
    guardianLastName: str(f, "guardianLastName"),
    guardianEmail: str(f, "guardianEmail"),
    guardianPhone: str(f, "guardianPhone"),
    relationship: str(f, "relationship") as never,
  });
  if (!r.ok) return { errors: r.errors, values: values(f) };
  revalidatePath("/students");
  redirect(`/students/${r.value.id}`);
}

export async function updateStudentAction(id: string, _prev: StudentFormState, f: FormData): Promise<StudentFormState> {
  const actor = await requireActor();
  const r = await updateStudent(actor, id, {
    firstName: str(f, "firstName"),
    lastName: str(f, "lastName"),
    dateOfBirth: str(f, "dateOfBirth"),
    siteId: str(f, "siteId"),
    status: str(f, "status") as never,
    medicalNotes: str(f, "medicalNotes"),
    firstAidConsent: f.get("firstAidConsent") === "on",
    photoConsent: f.get("photoConsent") === "on",
    licenceNumber: str(f, "licenceNumber"),
    licenceExpiresOn: str(f, "licenceExpiresOn"),
  });
  if (!r.ok) return { errors: r.errors, values: values(f) };
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}
