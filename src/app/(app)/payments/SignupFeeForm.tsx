"use client";

import { useActionState } from "react";
import { setSignupFeeAction, type PlanState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

export function SignupFeeForm({ pence }: { pence: number }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(setSignupFeeAction, {});
  const current = pence ? (pence / 100).toFixed(pence % 100 ? 2 : 0) : "";
  return (
    <form action={action} className="form" noValidate style={{ maxWidth: "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ flex: "0 1 200px" }}>
          <label htmlFor="signupFee">Sign-up fee per member (£)</label>
          <input id="signupFee" name="signupFee" inputMode="decimal" placeholder="None" defaultValue={state.values?.signupFee ?? current} {...errProps("signupFee", state.errors)} />
        </div>
        <button className="btn secondary" disabled={pending}>{pending ? "Saving…" : "Save fee"}</button>
        {state.saved && <span role="status" className="muted" style={{ paddingBottom: 10 }}>Saved</span>}
      </div>
      <FieldError id="signupFee-err" msg={state.errors?.signupFee} />
    </form>
  );
}
