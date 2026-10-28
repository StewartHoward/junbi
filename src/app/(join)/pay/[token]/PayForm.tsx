"use client";

import { useActionState, useState } from "react";
import { payAction, type PayState } from "./actions";
import { FieldError } from "@/components/FormBits";
import type { PayPage } from "@/data/paylink";

type Plan = PayPage["plans"][number];
const money = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;
const price = (p: Plan) => `${money(p.amountPence)} ${p.interval === "annual" ? "a year" : "a month"}`;

/** The family chooses a membership for each person, then goes on to set up Direct Debit. */
export function PayForm({ token, page }: { token: string; page: PayPage }) {
  const [state, action, pending] = useActionState<PayState, FormData>(payAction.bind(null, token), {});
  const e = state.errors;
  const start = Object.fromEntries(page.people.map((p) => [p.id, state.values?.[p.id] ?? p.suggestedPlanId ?? ""]));
  const [chosen, setChosen] = useState<Record<string, string>>(start);
  const picked = page.people.map((p) => page.plans.find((x) => x.id === chosen[p.id])).filter(Boolean) as Plan[];
  const monthly = picked.filter((p) => p.interval === "monthly").reduce((n, p) => n + p.amountPence, 0);
  const yearly = picked.filter((p) => p.interval === "annual").reduce((n, p) => n + p.amountPence, 0);
  const many = page.people.length > 1;

  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      {page.people.map((p) => (
        <fieldset key={p.id} className="m-person">
          <legend style={{ fontSize: 17 }}>{p.name}</legend>
          <div>
            <label htmlFor={`plan_${p.id}`}>Membership</label>
            <select
              id={`plan_${p.id}`}
              name={`plan_${p.id}`}
              defaultValue={start[p.id]}
              aria-invalid={e?.[p.id] ? true : undefined}
              onChange={(ev) => setChosen((c) => ({ ...c, [p.id]: ev.target.value }))}
            >
              <option value="" disabled>Choose one</option>
              {page.plans.map((x) => <option key={x.id} value={x.id}>{x.name} · {price(x)}</option>)}
              {many && <option value="none">Not joining for now</option>}
            </select>
            <FieldError id={`plan_${p.id}-err`} msg={e?.[p.id]} />
          </div>
        </fieldset>
      ))}
      <p className="m-fine" style={{ margin: 0 }}>
        {picked.length
          ? `Total: ${[monthly && `${money(monthly)} a month`, yearly && `${money(yearly)} a year`].filter(Boolean).join(" and ")}${
              page.signupFeePence ? `, plus a one-off sign-up fee of ${money(page.signupFeePence * picked.length)} with the first payment` : ""
            }. `
          : ""}
        Next you&apos;ll set up a Direct Debit with {page.provider === "stripe" ? "Stripe" : "GoCardless"}, protected by the Direct Debit Guarantee.
      </p>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Opening…" : "Continue to Direct Debit"}
      </button>
    </form>
  );
}
