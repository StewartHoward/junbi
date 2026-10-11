"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { addLead, bookLeadSession, deleteLead, getLead, setLeadStatus } from "@/data/leads";
import { sendJoinLink } from "@/data/join";
import type { FieldErrors } from "@/data/accounts";

export type LeadFormState = { errors?: FieldErrors; values?: Record<string, string>; done?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const values = (f: FormData) => {
  const v: Record<string, string> = {};
  for (const [k, val] of f.entries()) if (typeof val === "string" && !k.startsWith("$")) v[k] = val;
  return v;
};
const session = (f: FormData) => {
  const cls = str(f, "classId");
  return { classId: cls === "other" ? "" : cls, sessionDate: str(f, "sessionDate"), sessionTime: cls === "other" ? str(f, "sessionTime") : "" };
};

export async function addLeadAction(_prev: LeadFormState, f: FormData): Promise<LeadFormState> {
  const actor = await requireActor();
  const r = await addLead(actor, {
    firstName: str(f, "firstName"),
    lastName: str(f, "lastName"),
    email: str(f, "email"),
    phone: str(f, "phone"),
    studentName: str(f, "studentName"),
    studentAge: str(f, "studentAge"),
    siteId: str(f, "siteId"),
    source: str(f, "source"),
    notes: str(f, "notes"),
    ...session(f),
  });
  if (!r.ok) return { errors: r.errors, values: values(f) };
  revalidatePath("/leads");
  redirect(`/leads/${r.value.id}?added=${r.value.emailed ? "emailed" : "1"}`);
}

export async function bookLeadAction(id: string, _prev: LeadFormState, f: FormData): Promise<LeadFormState> {
  const actor = await requireActor();
  const r = await bookLeadSession(actor, id, session(f));
  if (!r.ok) return { errors: r.errors, values: values(f) };
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return { done: r.value.emailed ? "Trial booked. We've emailed them the details." : "Trial booked." };
}

export async function setLeadStatusAction(f: FormData) {
  const actor = await requireActor();
  const id = str(f, "leadId");
  await setLeadStatus(actor, id, str(f, "status"));
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function deleteLeadAction(f: FormData) {
  const actor = await requireActor();
  await deleteLead(actor, str(f, "leadId"));
  revalidatePath("/leads");
  redirect("/leads");
}

export async function sendLeadSignupAction(f: FormData) {
  const actor = await requireActor();
  const id = str(f, "leadId");
  const lead = await getLead(actor, id);
  if (!lead?.email) redirect(`/leads/${id}`);
  const r = await sendJoinLink(actor, lead.email);
  redirect(`/leads/${id}?${r.ok ? "linked=1" : "linkError=1"}`);
}
