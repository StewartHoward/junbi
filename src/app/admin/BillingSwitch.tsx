"use client";

import { useActionState } from "react";
import { switchOnBillingAction, type SwitchState } from "./actions";

export function BillingSwitch() {
  const [state, run, pending] = useActionState<SwitchState>(switchOnBillingAction, {});
  return (
    <form action={run} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button type="submit" className="btn primary sm" disabled={pending}>{pending ? "Connecting…" : "Connect billing to Stripe"}</button>
      {state.error && <span className="bad-t" role="alert">{state.error}</span>}
      {state.ok && <span className="ok-t" role="status">{state.ok}</span>}
    </form>
  );
}
