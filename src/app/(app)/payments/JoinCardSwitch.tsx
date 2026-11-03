"use client";

import { useOptimistic, useTransition } from "react";
import { setJoinCardAction } from "./actions";

/** Stripe clubs: let families pay by card as well as Direct Debit when they sign up. */
export function JoinCardSwitch({ on }: { on: boolean }) {
  const [value, setValue] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={value} disabled={pending} onChange={(e) => { const next = e.target.checked; start(async () => { setValue(next); await setJoinCardAction(next); }); }} style={{ width: 22, height: 22, flex: "none", marginTop: 2 }} />
      <span>
        <strong>Let families pay by card as well</strong>
        <span className="muted" style={{ display: "block", fontSize: 14, marginTop: 2 }}>When they sign up with your link or QR code, families choose Direct Debit or a debit or credit card. Card fees from Stripe are higher than Direct Debit, so switch this off if you only want Direct Debit.</span>
      </span>
    </label>
  );
}
