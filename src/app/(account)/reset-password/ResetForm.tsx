"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

export function ResetForm({ action }: { action: (prev: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors;
  return (
    <form action={formAction} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required {...errProps("password", e)} aria-describedby={e?.password ? "password-err" : "password-hint"} />
        {e?.password ? <FieldError id="password-err" msg={e.password} /> : <p id="password-hint" className="hint">At least 10 characters. A short phrase is easiest to remember.</p>}
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save and sign in"}
      </button>
    </form>
  );
}
