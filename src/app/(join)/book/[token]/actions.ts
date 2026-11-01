"use server";

import { redirect } from "next/navigation";
import { submitBooking } from "@/data/events";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type BookState = { errors?: FieldErrors; confirmed?: number; declinedOnly?: boolean };

export async function bookAction(token: string, _prev: BookState, f: FormData): Promise<BookState> {
  if (await rateLimited("book", 40)) return { errors: { form: "Lots of attempts from here just now. Please wait 15 minutes and try again." } };
  const chosen: string[] = [];
  const declined: string[] = [];
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("b_") || typeof v !== "string") continue;
    if (v === "yes") chosen.push(k.slice(2));
    if (v === "no") declined.push(k.slice(2));
  }
  const r = await submitBooking(token, chosen, declined);
  if (!r.ok) return { errors: r.errors };
  if (r.value.url) redirect(r.value.url);
  return { confirmed: r.value.confirmed, declinedOnly: r.value.confirmed === 0 };
}
