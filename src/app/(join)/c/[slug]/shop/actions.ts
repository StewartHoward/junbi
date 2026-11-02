"use server";

import { requireFeature } from "@/data/features";
import { redirect } from "next/navigation";
import { submitOrder } from "@/data/shop";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type OrderState = { errors?: FieldErrors; values?: Record<string, string>; done?: boolean };

export async function orderAction(slug: string, _prev: OrderState, f: FormData): Promise<OrderState> {
  await requireFeature("shop");
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = v;
  if (values.website) return { done: true }; // honeypot
  if (await rateLimited("shop", 30)) return { errors: { form: "Lots of orders from here just now. Please wait 15 minutes and try again." }, values };
  const items: Array<{ productId: string; option?: string; quantity: number }> = [];
  for (const [k, v] of Object.entries(values)) {
    const m = k.match(/^q_(.+)$/);
    const qty = Number(v);
    if (!m || !Number.isInteger(qty) || qty < 1) continue;
    items.push({ productId: m[1], option: values[`o_${m[1]}`] || undefined, quantity: Math.min(qty, 50) });
  }
  const r = await submitOrder(slug, { name: values.name ?? "", email: values.email ?? "", phone: values.phone, note: values.note, items });
  if (!r.ok) return { errors: r.errors, values };
  if (r.value.url) redirect(r.value.url);
  return { done: true };
}
