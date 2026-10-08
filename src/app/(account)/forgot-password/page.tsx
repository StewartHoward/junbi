"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  if (state.values?.sent) {
    return (
      <div className="m-auth">
        <h1>Check your email.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>
          If there&apos;s a Junbi account for {state.values.email}, we&apos;ve sent a link to choose a new password. It works for one hour.
        </p>
        <p className="m-auth-alt">
          Nothing arrived? Check your junk folder, or <a href="/forgot-password" className="m-link">try again</a>.
        </p>
      </div>
    );
  }
  return (
    <div className="m-auth">
      <h1>Forgotten your password?</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <form action={action} className="m-form" noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <p className="m-auth-alt">
          Remembered it? <Link href="/login" className="m-link">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
