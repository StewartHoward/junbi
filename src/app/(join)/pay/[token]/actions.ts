"use server";

import { redirect } from "next/navigation";
import { submitPay } from "@/data/paylink";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type PayState = { errors?: FieldErrors; values?: Record<string, string> };

export async function payAction(token: string, _prev: PayState, f: FormData): Promise<PayState> {
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && k.startsWith("plan_")) values[k.slice(5)] = v;
  if (await rateLimited("pay", 30)) return { errors: { form: "Lots of attempts from here just now. Please wait 15 minutes and try again." }, values };
  const r = await submitPay(token, values);
  if (!r.ok) return { errors: r.errors, values };
  redirect(r.value.url);
}
