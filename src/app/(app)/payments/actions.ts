"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { addPlan, archivePlan, disconnectPayments } from "@/data/payments";
import type { FieldErrors } from "@/data/accounts";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export type PlanState = { errors?: FieldErrors; values?: Record<string, string>; saved?: boolean };

export async function addPlanAction(_prev: PlanState, f: FormData): Promise<PlanState> {
  const actor = await requireActor();
  const values = { name: str(f, "name"), amount: str(f, "amount"), interval: str(f, "interval") };
  const r = await addPlan(actor, values as never);
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/payments");
  return { saved: true };
}

export async function archivePlanAction(f: FormData) {
  const actor = await requireActor();
  await archivePlan(actor, str(f, "planId"));
  revalidatePath("/payments");
}

export async function disconnectAction() {
  const actor = await requireActor();
  await disconnectPayments(actor);
  revalidatePath("/payments");
}
