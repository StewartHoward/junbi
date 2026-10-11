"use client";

import { useActionState, useEffect, useState } from "react";
import { FieldError } from "@/components/FormBits";
import type { MembershipState } from "../actions";

type Option = { id: string; label: string };

/** "Add membership" on a student's profile: pick a price, and Junbi starts it or emails the Direct Debit link. */
export function AddMembershipForm({ action, options, today }: { action: (s: MembershipState, f: FormData) => Promise<MembershipState>; options: Option[]; today: string }) {
  const [state, run, pending] = useActionState<MembershipState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  const e = state.errors;
  useEffect(() => { if (state.done) setOpen(false); }, [state]);

  if (!options.length) {
    return <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Add your prices in <a href="/settings#prices">Settings</a> to put students on a membership.</p>;
  }
  return (
    <div style={{ marginTop: 14 }}>
      {state.done && <p className="banner" role="status" style={{ marginBottom: 12 }}>{state.done}</p>}
      {!open ? (
        <button type="button" className="btn secondary" onClick={() => setOpen(true)}>Add membership</button>
      ) : (
        <form action={run} className="form" noValidate style={{ maxWidth: "none" }}>
          <div>
            <label htmlFor="m-plan">Membership</label>
            <select id="m-plan" name="planId" defaultValue="" aria-invalid={e?.planId ? true : undefined}>
              <option value="" disabled>Choose one</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <FieldError id="planId-err" msg={e?.planId} />
          </div>
          <div>
            <label htmlFor="m-start">Starts</label>
            <input id="m-start" name="startsOn" type="date" defaultValue={today} />
          </div>
          {e?.form && <p className="banner" role="alert">{e.form}</p>}
          <div className="actions">
            <button className="btn primary" disabled={pending}>{pending ? "Adding…" : "Add membership"}</button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>If you take Direct Debit and this family isn&apos;t set up yet, we&apos;ll email them the link to set it up.</p>
        </form>
      )}
    </div>
  );
}
