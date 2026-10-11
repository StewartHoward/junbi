"use client";

import { useActionState, useEffect, useState } from "react";
import type { LeadFormState } from "../actions";
import { SessionFields } from "../SessionFields";

type Cls = { id: string; name: string; siteId: string; weekday: number; startsAt: string };

export function BookForm({ action, classes, siteId, label }: { action: (s: LeadFormState, f: FormData) => Promise<LeadFormState>; classes: Cls[]; siteId: string | null; label: string }) {
  const [state, run, pending] = useActionState<LeadFormState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  useEffect(() => { if (state.done) setOpen(false); }, [state]);
  return (
    <div>
      {state.done && <p className="banner" role="status" style={{ marginBottom: 12 }}>{state.done}</p>}
      {!open ? (
        <button type="button" className="btn secondary" onClick={() => setOpen(true)}>{label}</button>
      ) : (
        <form action={run} className="form" noValidate style={{ maxWidth: "none" }}>
          <SessionFields classes={classes} siteId={siteId ?? undefined} values={state.values} errors={state.errors} />
          {state.errors?.form && <p className="banner" role="alert">{state.errors.form}</p>}
          <div className="actions">
            <button className="btn primary" disabled={pending}>{pending ? "Booking…" : "Book and email them"}</button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
