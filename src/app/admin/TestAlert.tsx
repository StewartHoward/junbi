"use client";

import { useActionState } from "react";
import { testAlertAction, type SwitchState } from "./actions";

export function TestAlert() {
  const [state, run, pending] = useActionState<SwitchState>(testAlertAction, {});
  return (
    <form action={run} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button type="submit" className="btn soft sm" disabled={pending}>{pending ? "Sending…" : "Send a test alert"}</button>
      {state.ok && <span className="ok-t small" role="status" style={{ fontSize: 13 }}>{state.ok}</span>}
    </form>
  );
}
