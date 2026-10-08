"use server";

import { redirect } from "next/navigation";
import { checkLogin, completeSetup, createClubAccount, type FieldErrors } from "@/data/accounts";
import { endSession, requireActorForSetup, startSession } from "@/auth/session";

export type FormState = { errors?: FieldErrors; values?: Record<string, string> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function signupAction(_prev: FormState, f: FormData): Promise<FormState> {
  if (str(f, "website")) redirect("/"); // honeypot
  const values = { clubName: str(f, "clubName"), name: str(f, "name"), email: str(f, "email"), plan: str(f, "plan"), terms: str(f, "terms") };
  const r = await createClubAccount({
    ...values,
    password: str(f, "password"),
    founding: str(f, "founding") === "1",
    terms: f.get("terms") === "on",
  });
  if (!r.ok) return { errors: r.errors, values };
  await startSession(r.value.userId);
  redirect("/setup");
}

export async function loginAction(_prev: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  const r = await checkLogin(email, str(f, "password"));
  if (!r.ok) return { errors: r.errors, values: { email } };
  await startSession(r.value.userId);
  redirect("/today");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function setupAction(_prev: FormState, f: FormData): Promise<FormState> {
  const actor = await requireActorForSetup();
  if (actor.onboarded) redirect("/today");
  const disciplines = f.getAll("disciplines").map(String);
  const syllabus: Record<string, string> = {};
  for (const id of disciplines) {
    const v = str(f, `syllabus_${id}`);
    if (v) syllabus[id] = v;
  }
  const r = await completeSetup(actor, {
    disciplines: disciplines as never,
    siteName: str(f, "siteName"),
    siteAddress: str(f, "siteAddress"),
    syllabus,
  });
  if (!r.ok) return { errors: r.errors, values: { siteName: str(f, "siteName"), siteAddress: str(f, "siteAddress"), disciplines: disciplines.join(",") } };
  redirect("/today");
}
