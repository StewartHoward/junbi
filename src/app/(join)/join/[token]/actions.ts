"use server";

import { MAX_CHILDREN, submitJoin } from "@/data/join";
import type { FieldErrors } from "@/data/accounts";

export type JoinState = { errors?: FieldErrors; values?: Record<string, string>; done?: { clubName: string; names: string[] } };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function joinAction(token: string, _prev: JoinState, f: FormData): Promise<JoinState> {
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  if (str(f, "website")) return { done: { clubName: "", names: [] } }; // honeypot: look successful, save nothing
  const count = Math.min(MAX_CHILDREN, Math.max(0, Number(str(f, "childCount")) || 0));
  const children = Array.from({ length: count }, (_, i) => ({
    firstName: str(f, `c${i}_firstName`),
    lastName: str(f, `c${i}_lastName`),
    dateOfBirth: str(f, `c${i}_dateOfBirth`),
    siteId: str(f, `c${i}_siteId`),
    medical: str(f, `c${i}_medical`),
  }));
  const r = await submitJoin(token, {
    who: str(f, "who") === "me" ? "me" : "children",
    parentFirstName: str(f, "parentFirstName"),
    parentLastName: str(f, "parentLastName"),
    email: str(f, "email"),
    phone: str(f, "phone"),
    myDateOfBirth: str(f, "myDateOfBirth"),
    mySiteId: str(f, "mySiteId"),
    myMedical: str(f, "myMedical"),
    children,
    firstAidConsent: f.get("firstAidConsent") === "on",
    photoConsent: f.get("photoConsent") === "on",
    terms: f.get("terms") === "on",
  });
  if (!r.ok) return { errors: r.errors, values };
  return { done: r.value };
}
