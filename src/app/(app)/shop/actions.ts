"use server";

import { requireFeature } from "@/data/features";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import type { FieldErrors } from "@/data/accounts";
import { saveProduct, setOrderStatus, setProductActive } from "@/data/shop";

export type ProductState = { errors?: FieldErrors; values?: Record<string, string>; saved?: number };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveProductAction(productId: string | null, prev: ProductState, f: FormData): Promise<ProductState> {
  await requireFeature("shop");
  const actor = await requireActor();
  const input = { name: str(f, "name"), description: str(f, "description"), price: str(f, "price"), options: str(f, "options") };
  const r = await saveProduct(actor, productId, input);
  if (!r.ok) return { errors: r.errors, values: input };
  revalidatePath("/shop");
  return { saved: (prev.saved ?? 0) + 1 };
}

export async function productActiveAction(f: FormData) {
  await requireFeature("shop");
  const actor = await requireActor();
  await setProductActive(actor, str(f, "productId"), str(f, "active") === "1");
  revalidatePath("/shop");
}

export async function orderStatusAction(f: FormData) {
  await requireFeature("shop");
  const actor = await requireActor();
  const change = str(f, "change");
  if (change === "handed_over" || change === "cancelled" || change === "paid") await setOrderStatus(actor, str(f, "orderId"), change);
  revalidatePath("/shop");
}
