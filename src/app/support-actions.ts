"use server";

import { sendSupportMessage } from "@/data/support";
import { rateLimited } from "@/data/accounts";

export type SupportState = { ok?: boolean; errors?: Partial<Record<string, string>> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function supportAction(_prev: SupportState, f: FormData): Promise<SupportState> {
  if (str(f, "website")) return { ok: true }; // honeypot
  if (await rateLimited("support", 5)) return { errors: { form: "Too many messages from here. Please wait 15 minutes, or email hello@junbi.co.uk." } };
  const r = await sendSupportMessage({ name: str(f, "name"), email: str(f, "email"), message: str(f, "message"), page: str(f, "page"), club: str(f, "club") });
  return r.ok ? { ok: true } : { errors: r.errors };
}
