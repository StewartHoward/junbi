"use server";

import { registerCompetitionInterest, type CompetitionInterest } from "@/data/competitions";
import { rateLimited } from "@/data/accounts";

export type InterestState = { ok?: boolean; errors?: Partial<Record<string, string>>; values?: Record<string, string> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function interestAction(_prev: InterestState, f: FormData): Promise<InterestState> {
  const values = { name: str(f, "name"), email: str(f, "email"), clubName: str(f, "clubName"), interest: str(f, "interest"), marketingOk: str(f, "marketingOk") };
  if (str(f, "website")) return { ok: true }; // honeypot
  if (await rateLimited("competitions-interest", 10)) return { errors: { form: "Too many requests from here. Please wait 15 minutes, or email hello@junbi.co.uk." }, values };
  try {
    const r = await registerCompetitionInterest({
      name: values.name,
      email: values.email,
      clubName: values.clubName,
      interest: values.interest as CompetitionInterest,
      marketingOk: values.marketingOk === "on",
    });
    return r.ok ? { ok: true } : { errors: r.errors, values };
  } catch (err) {
    console.error("competitions interest failed", err);
    return { errors: { form: "Sorry, that didn't work. Please try again in a minute, or email hello@junbi.co.uk." }, values };
  }
}
