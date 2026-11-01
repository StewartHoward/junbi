"use client";

import { useActionState } from "react";
import { familyLinkAction, type FamilyState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

export function FamilyLinkForm() {
  const [state, action, pending] = useActionState<FamilyState, FormData>(familyLinkAction, {});
  if (state.sent) {
    return (
      <div style={{ marginTop: 28 }}>
        <h2 className="m-h2" style={{ fontSize: 28 }}>Check your email.</h2>
        <p className="m-sub" style={{ fontSize: 18 }}>If {state.sent} is the email your club has for you, we&apos;ve sent you a sign-in link. It works for 30 minutes.</p>
        <p className="m-fine" style={{ marginTop: 12 }}>Nothing arrived? Check your junk folder, or ask the club which email they have for you.</p>
      </div>
    );
  }
  return (
    <form action={action} className="m-form" noValidate>
      {state.errors?.form && <p className="error" role="alert">{state.errors.form}</p>}
      <div>
        <label htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} {...errProps("email", state.errors)} />
        <FieldError id="email-err" msg={state.errors?.email} />
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      <p className="m-fine" style={{ margin: 0 }}>Use the email you gave the club. There&apos;s no password to remember.</p>
    </form>
  );
}
