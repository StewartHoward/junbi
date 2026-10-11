"use client";

import { useActionState } from "react";
import { addCardAction, billingCodeAction, manageBillingAction, type BillingState } from "./actions";

export function AddCardButton({ label }: { label: string }) {
  const [state, run, pending] = useActionState<BillingState>(addCardAction, {});
  return (
    <form action={run}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="m-btn primary" disabled={pending}>{pending ? "Opening…" : label}</button>
    </form>
  );
}

export function ManageBillingButton() {
  const [state, run, pending] = useActionState<BillingState>(manageBillingAction, {});
  return (
    <form action={run}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="m-btn" disabled={pending}>{pending ? "Opening…" : "Update card or see invoices"}</button>
    </form>
  );
}

export function BillingCodeForm() {
  const [state, run, pending] = useActionState<BillingState, FormData>(billingCodeAction, {});
  return (
    <form action={run} className="m-form" noValidate style={{ marginTop: 8 }}>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p role="status">{state.ok}</p>}
      <div>
        <label htmlFor="promoCode">Discount code</label>
        <input id="promoCode" name="promoCode" autoComplete="off" />
      </div>
      <button type="submit" className="m-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Checking…" : "Apply code"}</button>
    </form>
  );
}
