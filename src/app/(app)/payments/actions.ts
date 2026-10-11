"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { addPlan, archivePlan, disconnectPayments, setSignupFee } from "@/data/payments";
import { connectStripeKey, takeOver, type TakeoverResult } from "@/data/stripe-own";
import { appUrl } from "@/lib/email";
import { redirect } from "next/navigation";
import type { FieldErrors } from "@/data/accounts";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export type PlanState = { errors?: FieldErrors; values?: Record<string, string>; saved?: boolean };

export async function addPlanAction(_prev: PlanState, f: FormData): Promise<PlanState> {
  const actor = await requireActor();
  const values = { name: str(f, "name"), amount: str(f, "amount"), interval: str(f, "interval") };
  const r = await addPlan(actor, values as never);
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/payments");
  revalidatePath("/settings");
  return { saved: true };
}

export async function archivePlanAction(f: FormData) {
  const actor = await requireActor();
  await archivePlan(actor, str(f, "planId"));
  revalidatePath("/payments");
  revalidatePath("/settings");
}

export async function disconnectAction() {
  const actor = await requireActor();
  await disconnectPayments(actor);
  revalidatePath("/payments");
}

export async function setSignupFeeAction(_prev: PlanState, f: FormData): Promise<PlanState> {
  const actor = await requireActor();
  const r = await setSignupFee(actor, str(f, "signupFee"));
  if (!r.ok) return { errors: r.errors, values: { signupFee: str(f, "signupFee") } };
  revalidatePath("/payments");
  revalidatePath("/settings");
  return { saved: true };
}

export type KeyState = { errors?: FieldErrors };

export async function connectStripeKeyAction(_prev: KeyState, f: FormData): Promise<KeyState> {
  const actor = await requireActor();
  const r = await connectStripeKey(actor, str(f, "key"), await appUrl());
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/payments");
  redirect("/payments?connected=own");
}

export type TakeoverState = { errors?: FieldErrors; results?: TakeoverResult[] };

export async function takeOverAction(_prev: TakeoverState, f: FormData): Promise<TakeoverState> {
  const actor = await requireActor();
  const rows = f.getAll("pick").map(String).map((id) => ({ subscriptionId: id, studentId: str(f, `student_${id}`), planId: str(f, `plan_${id}`) }));
  const r = await takeOver(actor, rows);
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/payments");
  revalidatePath("/payments/takeover");
  return { results: r.value.results };
}
