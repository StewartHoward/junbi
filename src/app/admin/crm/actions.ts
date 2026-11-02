"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crmAddContact, crmAddNote, crmUpdate, deliverEbook } from "@/data/crm";

export type CrmState = { ok?: string; errors?: Partial<Record<string, string>> };
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function updateContactAction(id: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  const r = await crmUpdate(id, { stage: str(f, "stage") as never, nextActionOn: str(f, "nextActionOn"), name: str(f, "name"), clubName: str(f, "clubName"), phone: str(f, "phone") });
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  return { ok: "Saved." };
}

export async function addNoteAction(id: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  const r = await crmAddNote(id, str(f, "note"));
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/admin/crm/${id}`);
  return { ok: "Note added." };
}

export async function addContactAction(_prev: CrmState, f: FormData): Promise<CrmState> {
  const r = await crmAddContact({ name: str(f, "name"), email: str(f, "email"), clubName: str(f, "clubName"), phone: str(f, "phone") });
  if (!r.ok) return { errors: r.errors };
  redirect(`/admin/crm/${r.value.id}`);
}

export async function deliverEbookAction(slug: string, _prev: CrmState): Promise<CrmState> {
  const r = await deliverEbook(slug);
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/admin/crm");
  return { ok: r.value.sent ? `Sent to ${r.value.sent} ${r.value.sent === 1 ? "person" : "people"}.` : "Nobody is waiting for it." };
}
