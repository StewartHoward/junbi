"use client";

import { useActionState } from "react";
import type { MembershipState } from "../actions";

/** Emails the family a link to choose a membership and set up Direct Debit. */
export function SendPayLinkButton({ action }: { action: (s: MembershipState, f: FormData) => Promise<MembershipState> }) {
  const [state, run, pending] = useActionState<MembershipState, FormData>(action, {});
  return (
    <form action={run} style={{ marginTop: 14 }}>
      {state.done && <p className="banner" role="status" style={{ marginBottom: 12 }}>{state.done}</p>}
      {state.errors?.form && <p className="banner" role="alert" style={{ marginBottom: 12 }}>{state.errors.form}</p>}
      {!state.done && (
        <>
          <button className="btn primary" disabled={pending}>{pending ? "Sending…" : "Send plan and payment link"}</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Emails the family a link to choose a membership and set up their Direct Debit.</p>
        </>
      )}
    </form>
  );
}
