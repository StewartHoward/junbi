"use server";

import { redirect } from "next/navigation";
import { placeLibraryOrder, libraryUnsubscribe } from "@/data/crm";
import { rateLimited } from "@/data/accounts";

export type CheckoutState = { errors?: Partial<Record<string, string>>; values?: Record<string, string | string[]> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function checkoutAction(_prev: CheckoutState, f: FormData): Promise<CheckoutState> {
  const values = { name: str(f, "name"), email: str(f, "email"), clubName: str(f, "clubName"), role: str(f, "role"), size: str(f, "size"), system: str(f, "system"), arts: f.getAll("arts").map(String), items: f.getAll("items").map(String), marketingOk: f.get("marketingOk") === "on" ? "on" : "" };
  if (str(f, "website")) redirect("/library"); // honeypot
  if (await rateLimited("library", 10)) return { errors: { form: "Too many orders from here. Please wait 15 minutes and try again." }, values };
  const r = await placeLibraryOrder({ ...values, role: values.role as never, size: values.size as never, system: values.system as never, arts: values.arts as never, marketingOk: values.marketingOk === "on" });
  if (!r.ok) return { errors: r.errors, values };
  redirect(`/library/order/${r.value.token}`);
}

export async function unsubscribeAction(token: string): Promise<{ done: boolean }> {
  return { done: await libraryUnsubscribe(token) };
}
