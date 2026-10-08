"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

export function InviteForm({
  action,
  email,
  existing,
}: {
  action: (prev: FormState, f: FormData) => Promise<FormState>;
  email: string;
  existing: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors;
  return (
    <form action={formAction} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" value={email} readOnly aria-readonly="true" style={{ background: "#f5f5f7" }} />
      </div>
      {!existing && (
        <div>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} required {...errProps("name", e)} />
          <FieldError id="name-err" msg={e?.name} />
        </div>
      )}
      <div>
        <label htmlFor="password">{existing ? "Your Junbi password" : "Choose a password"}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={existing ? "current-password" : "new-password"}
          required
          {...errProps("password", e)}
          aria-describedby={e?.password ? "password-err" : existing ? undefined : "password-hint"}
        />
        {e?.password ? <FieldError id="password-err" msg={e.password} /> : !existing && <p id="password-hint" className="hint">At least 10 characters. A short phrase is easiest to remember.</p>}
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Joining…" : "Accept and join"}
      </button>
      {existing && (
        <p className="m-auth-alt">
          Forgotten it? <Link href="/forgot-password" className="m-link">Reset your password</Link>, then come back to this link.
        </p>
      )}
    </form>
  );
}
