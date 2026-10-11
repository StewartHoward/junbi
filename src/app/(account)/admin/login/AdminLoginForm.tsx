"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";
import type { FormState } from "@/app/(account)/actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLoginAction, {});
  return (
    <form action={action} className="m-form" noValidate>
      {state.errors?.form && <p className="error" role="alert">{state.errors.form}</p>}
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
