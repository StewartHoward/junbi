"use server";

import { requireFeature } from "@/data/features";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import type { FieldErrors } from "@/data/accounts";
import { saveSections, saveWebsite, setCustomDomain, uploadWebsiteImage } from "@/data/website";

export async function saveSectionsAction(json: string, publish: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireFeature("website");
  const actor = await requireActor();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "Couldn't save. Please refresh and try again." };
  }
  const r = await saveSections(actor, raw, publish);
  if (!r.ok) return { ok: false, error: r.errors.form };
  if (publish) revalidatePath("/website");
  return { ok: true };
}

export async function uploadImageAction(dataUrl: string, width: number, height: number): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireFeature("website");
  const actor = await requireActor();
  const r = await uploadWebsiteImage(actor, dataUrl, { width, height });
  return r.ok ? { ok: true, id: r.value.id } : { ok: false, error: r.errors.form ?? "Couldn't upload that photo." };
}

export type SettingsState = { errors?: FieldErrors; saved?: boolean; values?: Record<string, string> };

export async function websiteSettingsAction(_prev: SettingsState, f: FormData): Promise<SettingsState> {
  await requireFeature("website");
  const actor = await requireActor();
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = v;
  const r = await saveWebsite(actor, { slug: values.slug ?? "", phone: values.phone, email: values.email, colour: values.colour, showPrices: true, published: f.get("published") === "on" });
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/website");
  return { saved: true };
}

export type DomainState = { errors?: FieldErrors; done?: string };

export async function domainAction(_prev: DomainState, f: FormData): Promise<DomainState> {
  await requireFeature("website");
  const actor = await requireActor();
  const r = await setCustomDomain(actor, String(f.get("domain") ?? ""));
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/website");
  return { done: r.value.domain ? (r.value.automatic ? "Saved. Now add the records below with whoever you bought your domain from." : "Saved. We're connecting it for you, which can take up to a day. Meanwhile, add the records below with whoever you bought your domain from.") : "Disconnected." };
}
