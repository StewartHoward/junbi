"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { createDiscount, deleteDiscount, setDiscountActive } from "@/data/discounts";
import type { FieldErrors } from "@/data/accounts";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export type DiscountState = { errors?: FieldErrors; values?: Record<string, string>; saved?: string };

export async function createDiscountAction(_prev: DiscountState, f: FormData): Promise<DiscountState> {
  const actor = await requireActor();
  const who = str(f, "who") === "one" ? "one" : "anyone";
  const values = { who, code: str(f, "code"), percent: str(f, "percent"), note: str(f, "note"), maxUses: str(f, "maxUses"), expiresOn: str(f, "expiresOn") };
  const r = await createDiscount(actor, { code: values.code, percent: values.percent, note: values.note, maxUses: who === "one" ? "1" : values.maxUses, expiresOn: values.expiresOn });
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/discounts");
  return { saved: r.value.code };
}

export async function setDiscountActiveAction(f: FormData) {
  const actor = await requireActor();
  await setDiscountActive(actor, str(f, "id"), str(f, "active") === "1");
  revalidatePath("/discounts");
}

export async function deleteDiscountAction(f: FormData) {
  const actor = await requireActor();
  await deleteDiscount(actor, str(f, "id"));
  revalidatePath("/discounts");
}
