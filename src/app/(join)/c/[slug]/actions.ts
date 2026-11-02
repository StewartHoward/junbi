"use server";

import { requireFeature } from "@/data/features";
import { websiteTrial } from "@/data/website";
import { rateLimited, type FieldErrors } from "@/data/accounts";

export type TrialState = { errors?: FieldErrors; values?: Record<string, string>; done?: boolean };

export async function trialAction(slug: string, _prev: TrialState, f: FormData): Promise<TrialState> {
  await requireFeature("website");
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = v;
  if (values.website) return { done: true }; // honeypot
  if (await rateLimited("trial", 20)) return { errors: { form: "Lots of requests from here just now. Please wait 15 minutes and try again." }, values };
  const who = values.who === "child";
  const r = await websiteTrial(slug, {
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    email: values.email ?? "",
    phone: values.phone ?? "",
    studentName: who ? values.studentName ?? "" : "",
    studentAge: who ? values.studentAge ?? "" : "",
    classId: values.classId ?? "",
    sessionDate: values.classId ? values.sessionDate ?? "" : "",
  });
  if (!r.ok) return { errors: r.errors, values };
  return { done: true };
}
