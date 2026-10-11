"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { createStudent, recordBelt, updateFamilyContact, updateStudent } from "@/data/student-edit";
import type { FieldErrors } from "@/data/accounts";
import { addStudentMembership } from "@/data/payments";

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

export async function recordBeltAction(studentId: string, _prev: StudentFormState, f: FormData): Promise<StudentFormState> {
  const actor = await requireActor();
  const r = await recordBelt(actor, studentId, { gradeId: str(f, "gradeId"), gradedOn: str(f, "gradedOn") });
  if (!r.ok) return { errors: r.errors, values: values(f) };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { values: {} };
}

/* ---------- Import ---------- */

export type ImportState = {
  csv?: string;
  fileName?: string;
  siteId?: string;
  discipline?: string;
  preview?: import("@/data/student-import").ImportPreview;
  errors?: Record<string, string | undefined>;
  done?: { students: number; families: number; belts: number };
};

const MAX_FILE_BYTES = 3_000_000;

export async function importStudentsAction(prev: ImportState, f: FormData): Promise<ImportState> {
  const { previewImport, runImport } = await import("@/data/student-import");
  const { IMPORT_FIELDS } = await import("@/lib/import");
  const actor = await requireActor();
  const intent = str(f, "intent");
  if (intent === "reset") return {};

  let csv = str(f, "csv");
  let fileName = str(f, "fileName");
  const file = f.get("file");
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return { errors: { file: "That file is too big. Split it into smaller files." } };
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) return { errors: { file: "Save it as a CSV file first (in Excel or Numbers: File, Save As, CSV)." } };
    csv = await file.text();
    fileName = file.name;
  }
  if (!csv) return { errors: { file: "Choose your CSV file." } };

  // Mapping comes from the column pickers once the file has been read; the first time, it's guessed.
  let mapping: Record<string, number> | null = null;
  if (f.has("map_fullName") && !(file && typeof file === "object" && "size" in file && file.size > 0)) {
    mapping = {};
    for (const fld of IMPORT_FIELDS) {
      const v = Number(str(f, `map_${fld.id}`));
      if (Number.isInteger(v) && v >= 0) mapping[fld.id] = v;
    }
  }
  const defaults = { siteId: str(f, "siteId"), discipline: str(f, "discipline") };
  const base = { csv, fileName, siteId: defaults.siteId, discipline: defaults.discipline };

  if (intent === "import") {
    const r = await runImport(actor, csv, mapping, defaults);
    if (!r.ok) return { ...base, preview: prev.preview, errors: r.errors };
    revalidatePath("/students");
    revalidatePath("/today");
    return { done: r.value };
  }
  const p = await previewImport(actor, csv, mapping, defaults);
  if (!p.ok) return { ...base, errors: p.errors };
  return { ...base, preview: p.value };
}

/* ---------- Family sign-up link ---------- */

export async function sendJoinLinkAction(_prev: StudentFormState & { sent?: string }, f: FormData): Promise<StudentFormState & { sent?: string }> {
  const { sendJoinLink } = await import("@/data/join");
  const actor = await requireActor();
  const r = await sendJoinLink(actor, str(f, "email"));
  if (!r.ok) return { errors: r.errors, values: { email: str(f, "email") } };
  return { sent: r.value.email };
}

export type MembershipState = { errors?: FieldErrors; done?: string };

export async function addMembershipAction(id: string, _prev: MembershipState, f: FormData): Promise<MembershipState> {
  const actor = await requireActor();
  const r = await addStudentMembership(actor, id, { planId: str(f, "planId"), startsOn: str(f, "startsOn"), withSignupFee: f.get("withSignupFee") === "on" });
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/students/${id}`);
  return { done: r.value.emailed ? `Direct Debit link emailed to ${r.value.emailed}. The membership starts once they've set it up.` : "Membership added." };
}

export type ContactState = { errors?: FieldErrors; saved?: boolean };

export async function updateContactAction(id: string, _prev: ContactState, f: FormData): Promise<ContactState> {
  const actor = await requireActor();
  const ids = f.getAll("guardianId").map(String);
  const r = await updateFamilyContact(actor, id, {
    guardians: ids.map((gid) => ({ id: gid, firstName: str(f, `g_${gid}_firstName`), lastName: str(f, `g_${gid}_lastName`), email: str(f, `g_${gid}_email`), phone: str(f, `g_${gid}_phone`) })),
    addressLine1: str(f, "addressLine1"),
    addressLine2: str(f, "addressLine2"),
    town: str(f, "town"),
    postcode: str(f, "postcode"),
    emergencyName: str(f, "emergencyName"),
    emergencyPhone: str(f, "emergencyPhone"),
  });
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/students");
  return { saved: true };
}
