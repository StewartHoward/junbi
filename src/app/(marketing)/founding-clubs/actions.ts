"use server";

import { db } from "@/db/client";
import { foundingClubSignups } from "@/db/schema";
import { parseSignupForm } from "@/data/signups";

export type SignupState = {
  status: "idle" | "error" | "done";
  errors?: Partial<Record<string, string>>;
  clubName?: string;
};

export async function submitSignup(_prev: SignupState, form: FormData): Promise<SignupState> {
  // Honeypot: real people never see or fill this field.
  if (String(form.get("website") ?? "") !== "") return { status: "done" };

  const parsed = parseSignupForm(form);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { status: "error", errors };
  }

  try {
    await db().insert(foundingClubSignups).values(parsed.data);
  } catch (err) {
    console.error("Founding Club sign-up failed", err);
    return { status: "error", errors: { form: "Something went wrong saving your details. Please try again in a minute." } };
  }
  return { status: "done", clubName: parsed.data.clubName };
}
