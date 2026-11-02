"use server";

import { requireFeature } from "@/data/features";
import { redirect } from "next/navigation";
import { endFamilySession, familyEmail, sendFamilyLink, updateFamilyDetails } from "@/data/family";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type FamilyState = { errors?: FieldErrors; sent?: string; saved?: boolean; values?: Record<string, string> };

export async function familyLinkAction(_prev: FamilyState, f: FormData): Promise<FamilyState> {
  await requireFeature("family");
  const email = String(f.get("email") ?? "");
  if (await rateLimited("family-link", 10)) return { errors: { form: "Lots of attempts from here just now. Please wait 15 minutes and try again." }, values: { email } };
  const r = await sendFamilyLink(email);
  if (!r.ok) return { errors: r.errors, values: { email } };
  return { sent: r.value.email };
}

export async function familyDetailsAction(clubId: string, householdId: string, _prev: FamilyState, f: FormData): Promise<FamilyState> {
  await requireFeature("family");
  const email = await familyEmail();
  if (!email) redirect("/family");
  const str = (k: string) => String(f.get(k) ?? "");
  const medical: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("med_") && typeof v === "string") medical[k.slice(4)] = v;
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = v;
  const r = await updateFamilyDetails(email, clubId, householdId, {
    phone: str("phone"),
    addressLine1: str("addressLine1"),
    addressLine2: str("addressLine2"),
    town: str("town"),
    postcode: str("postcode"),
    emergencyName: str("emergencyName"),
    emergencyPhone: str("emergencyPhone"),
    medical,
  });
  if (!r.ok) return { errors: r.errors, values };
  return { saved: true };
}

export async function familySignOutAction() {
  await endFamilySession();
  redirect("/family");
}
