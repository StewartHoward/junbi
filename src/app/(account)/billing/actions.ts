"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser, requireActorForSetup } from "@/auth/session";
import { billingPortal, startBillingCheckout } from "@/data/billing";
import { applyPromoCode } from "@/data/club";
import { appUrl } from "@/lib/email";

export type BillingState = { error?: string; ok?: string };

export async function addCardAction(_prev: BillingState): Promise<BillingState> {
  const actor = await requireActorForSetup();
  const user = await currentUser();
  let url: string;
  try {
    url = await startBillingCheckout(actor, await appUrl(), user?.email ?? "");
  } catch (err) {
    console.error("billing checkout failed", err);
    return { error: `Couldn't open the card page: ${(err as Error).message}` };
  }
  redirect(url);
}

export async function manageBillingAction(_prev: BillingState): Promise<BillingState> {
  const actor = await requireActorForSetup();
  let url: string;
  try {
    url = await billingPortal(actor, await appUrl());
  } catch (err) {
    console.error("billing portal failed", err);
    return { error: `Couldn't open billing: ${(err as Error).message}` };
  }
  redirect(url);
}

export async function billingCodeAction(_prev: BillingState, f: FormData): Promise<BillingState> {
  const actor = await requireActorForSetup();
  const r = await applyPromoCode(actor, String(f.get("promoCode") ?? ""));
  if (!r.ok) return { error: r.errors.promoCode ?? "That code isn't valid." };
  revalidatePath("/billing");
  return { ok: r.value.percentOff >= 100 ? "Code applied. Your account is free." : `Code applied: ${r.value.percentOff}% off.` };
}
