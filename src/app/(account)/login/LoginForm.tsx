"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
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
      <p className="m-auth-alt">
        New to Junbi? <Link href="/signup" className="m-link">Start a free trial</Link>
        <br />
        Forgotten your password? Contact Junbi support and we&apos;ll reset it for you.
      </p>
    </form>
  );
}
