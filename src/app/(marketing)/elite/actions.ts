"use server";

import { sendEliteBrochure, sendEliteEnquiry } from "@/data/elite";
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

export type BrochureState = { ok?: boolean; url?: string; errors?: Partial<Record<string, string>>; values?: Record<string, string> };

export async function brochureAction(_prev: BrochureState, f: FormData): Promise<BrochureState> {
  const values = { name: str(f, "name"), email: str(f, "email"), marketingOk: str(f, "marketingOk") };
  if (str(f, "website")) return { ok: true, url: "/downloads/junbi-elite-brochure.pdf" }; // honeypot
  if (await rateLimited("elite-brochure", 10)) return { errors: { form: "Too many requests from here. Please wait 15 minutes, or email hello@junbi.co.uk." }, values };
  try {
    const r = await sendEliteBrochure({ name: values.name, email: values.email, marketingOk: values.marketingOk === "on" });
    return r.ok ? { ok: true, url: r.value.url } : { errors: r.errors, values };
  } catch (err) {
    console.error("elite brochure failed", err);
    return { errors: { form: "Sorry, that didn't work. Please try again in a minute, or email hello@junbi.co.uk." }, values };
  }
}
