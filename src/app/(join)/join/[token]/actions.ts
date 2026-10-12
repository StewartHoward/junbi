"use server";

import { redirect } from "next/navigation";
import { MAX_CHILDREN, submitJoin } from "@/data/join";
import { appUrl } from "@/lib/email";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type JoinState = { errors?: FieldErrors; values?: Record<string, string>; done?: { clubName: string; names: string[]; paymentError?: string } };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function joinAction(token: string, _prev: JoinState, f: FormData): Promise<JoinState> {
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  if (str(f, "website")) return { done: { clubName: "", names: [] } }; // honeypot: look successful, save nothing
  // Generous, so a club's own tablet at an open day isn't blocked, but stops a script filling the club with junk.
  if (await rateLimited("join", 30)) return { errors: { form: "Lots of sign-ups from here just now. Please wait 15 minutes and try again." }, values };
  const count = Math.min(MAX_CHILDREN, Math.max(0, Number(str(f, "childCount")) || 0));
  const children = Array.from({ length: count }, (_, i) => ({
    firstName: str(f, `c${i}_firstName`),
    lastName: str(f, `c${i}_lastName`),
    dateOfBirth: str(f, `c${i}_dateOfBirth`),
    siteId: str(f, `c${i}_siteId`),
    medical: str(f, `c${i}_medical`),
    planId: str(f, `c${i}_planId`),
  }));
  const base = await appUrl();
  const r = await submitJoin(token, {
    who: str(f, "who") === "me" ? "me" : "children",
    parentFirstName: str(f, "parentFirstName"),
    parentLastName: str(f, "parentLastName"),
    email: str(f, "email"),
    phone: str(f, "phone"),
    addressLine1: str(f, "addressLine1"),
    town: str(f, "town"),
    postcode: str(f, "postcode"),
    emergencyName: str(f, "emergencyName"),
    emergencyPhone: str(f, "emergencyPhone"),
    myDateOfBirth: str(f, "myDateOfBirth"),
    mySiteId: str(f, "mySiteId"),
    myMedical: str(f, "myMedical"),
    myPlanId: str(f, "myPlanId"),
    children,
    firstAidConsent: f.get("firstAidConsent") === "on",
    photoConsent: f.get("photoConsent") === "on",
    terms: f.get("terms") === "on",
  }, {
    success: (setupId) => `${base}/join/${token}/done?setup=${setupId}`,
    cancel: `${base}/join/${token}/done?cancelled=1`,
  });
  if (!r.ok) return { errors: r.errors, values };
  if (r.value.paymentUrl) redirect(r.value.paymentUrl);
  return { done: { clubName: r.value.clubName, names: r.value.names, paymentError: r.value.paymentError } };
}
