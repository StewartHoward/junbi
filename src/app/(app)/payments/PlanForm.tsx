"use client";

import { useActionState } from "react";
import { addPlanAction, type PlanState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

export function PlanForm() {
  const [state, action, pending] = useActionState<PlanState, FormData>(addPlanAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  return (
    <form action={action} className="form" noValidate key={state.saved ? Date.now() : "form"} style={{ maxWidth: "none" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "start" }}>
        <div>
          <label htmlFor="plan-name">Name</label>
          <input id="plan-name" name="name" placeholder="e.g. Kids monthly" defaultValue={v.name} {...errProps("name", e)} />
          <FieldError id="name-err" msg={e?.name} />
        </div>
        <div>
          <label htmlFor="plan-amount">Price (£)</label>
          <input id="plan-amount" name="amount" inputMode="decimal" placeholder="35" defaultValue={v.amount} {...errProps("amount", e)} />
          <FieldError id="amount-err" msg={e?.amount} />
        </div>
        <div>
          <label htmlFor="plan-interval">How often</label>
          <select id="plan-interval" name="interval" defaultValue={v.interval || "monthly"}>
            <option value="monthly">Every month</option>
            <option value="annual">Every year</option>
          </select>
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" disabled={pending}>{pending ? "Adding…" : "Add price"}</button>
        {state.saved && <span role="status" className="muted">Added</span>}
      </div>
    </form>
  );
}
