"use server";

import { redirect } from "next/navigation";
import { checkLogin } from "@/data/accounts";
import { endSession, startSession } from "@/auth/session";
import { isSuperAdmin } from "@/auth/admin";
import type { FormState } from "@/app/(account)/actions";
import { requestAdminSetup } from "@/data/email-flows";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const NOPE = "That email and password don't match a Junbi admin login.";

/** Same password check as clubs, but only Junbi admins get a session here. */
export async function adminLoginAction(_prev: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  if (!isSuperAdmin(email)) {
    // Still run the check so a wrong guess costs the same time and counts towards the lockout.
    await checkLogin(email, str(f, "password"));
    return { errors: { form: NOPE }, values: { email } };
  }
  const r = await checkLogin(email, str(f, "password"));
  if (!r.ok) return { errors: r.errors, values: { email } };
  await startSession(r.value.userId);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await endSession();
  redirect("/admin/login");
}

/** First time in, or forgotten password: email a link to choose one. Same answer for any email. */
export async function adminSetupAction(_prev: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  await requestAdminSetup(email).catch((err) => console.error("admin set-up email failed", err));
  return { values: { email, sent: "1" } };
}

export type SwitchState = { ok?: string; error?: string };

/** Creates Junbi's billing webhook on Junbi's Stripe account so club payments show here. */
export async function switchOnBillingAction(): Promise<SwitchState> {
  const { requireSuperAdmin } = await import("@/auth/admin");
  await requireSuperAdmin();
  const { ensureBillingWebhook } = await import("@/data/billing");
  const { appUrl } = await import("@/lib/email");
  try {
    const r = await ensureBillingWebhook(await appUrl());
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin");
    return { ok: r.created ? "Connected. Club payments will now show here." : "Already connected." };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
