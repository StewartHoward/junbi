"use client";

import { useActionState } from "react";
import { adminSetupAction } from "@/app/admin/actions";
import type { FormState } from "@/app/(account)/actions";

/** First time signing in, or forgotten the password: emails a link to choose one. */
export function AdminSetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSetupAction, {});
  if (state.values?.sent) {
    return <p role="status" style={{ marginTop: 12 }}>If that&apos;s a Junbi admin email, a link to choose your password is on its way. It works for one hour.</p>;
  }
  return (
    <form action={action} className="m-form" noValidate style={{ marginTop: 12 }}>
      <div>
        <label htmlFor="setup-email">Admin email</label>
        <input id="setup-email" name="email" type="email" autoComplete="email" required />
      </div>
      <button type="submit" className="m-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
