"use client";

import { useActionState } from "react";
import { connectStripeKeyAction, type KeyState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

export function KeyForm() {
  const [state, action, pending] = useActionState<KeyState, FormData>(connectStripeKeyAction, {});
  return (
    <form action={action} className="form" noValidate>
      <div>
        <label htmlFor="key">Your Stripe key</label>
        <input id="key" name="key" type="password" autoComplete="off" spellCheck={false} placeholder="sk_live_… or rk_live_…" {...errProps("key", state.errors)} />
        <FieldError id="key-err" msg={state.errors?.key} />
      </div>
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Connecting…" : "Connect my Stripe account"}</button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Junbi stores your key encrypted and only uses it to run your club&apos;s memberships. You can disconnect and delete the key in Stripe at any time.</p>
    </form>
  );
}
