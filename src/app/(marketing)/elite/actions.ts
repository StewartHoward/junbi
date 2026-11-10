"use server";

import { sendEliteEnquiry } from "@/data/elite";
import { rateLimited } from "@/data/accounts";

export type EliteState = { ok?: boolean; errors?: Partial<Record<string, string>>; values?: Record<string, string | string[]> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function eliteAction(_prev: EliteState, f: FormData): Promise<EliteState> {
  const values = {
    name: str(f, "name"), email: str(f, "email"), phone: str(f, "phone"), clubName: str(f, "clubName"), currentSite: str(f, "currentSite"),
    size: str(f, "size"), sites: str(f, "sites"), system: str(f, "system"), message: str(f, "message"), arts: f.getAll("arts").map(String),
  };
  if (str(f, "website")) return { ok: true }; // honeypot
  if (await rateLimited("elite", 5)) return { errors: { form: "Too many enquiries from here. Please wait 15 minutes, or email hello@junbi.co.uk." }, values };
  try {
    const r = await sendEliteEnquiry({ ...values, size: values.size as never, sites: values.sites as never, system: values.system as never, arts: values.arts as never });
    return r.ok ? { ok: true } : { errors: r.errors, values };
  } catch (err) {
    console.error("elite enquiry failed", err);
    return { errors: { form: "Sorry, that didn't send. Please try again in a minute, or email hello@junbi.co.uk." }, values };
  }
}
