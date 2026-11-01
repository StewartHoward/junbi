"use client";

import { useActionState, useState } from "react";
import type { NoteState } from "../actions";

type Action = (s: NoteState, f: FormData) => Promise<NoteState>;
type Candidate = { id: string; name: string; detail: string; ready: boolean };

function Note({ state }: { state: NoteState }) {
  if (state.errors?.form) return <p className="banner" role="alert" style={{ marginBottom: 12 }}>{state.errors.form}</p>;
  if (state.done) return <p className="banner" role="status" style={{ marginBottom: 12 }}>{state.done}</p>;
  return null;
}

/** Tick who to invite. For a grading, the students ready for their next belt are ticked to start with. */
export function InviteForm({ action, candidates, grading }: { action: Action; candidates: Candidate[]; grading: boolean }) {
  const [state, run, pending] = useActionState<NoteState, FormData>(action, {});
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.ready).map((c) => c.id)));
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const ready = candidates.filter((c) => c.ready).length;
  if (!candidates.length) return <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Everyone has been invited.</p>;
  return (
    <form action={run} style={{ marginTop: 12 }}>
      <Note state={state} />
      <div className="actions" style={{ flexWrap: "wrap", marginBottom: 10 }}>
        {grading && <button type="button" className="btn soft sm" onClick={() => setPicked(new Set(candidates.filter((c) => c.ready).map((c) => c.id)))}>Ready to grade ({ready})</button>}
        <button type="button" className="btn soft sm" onClick={() => setPicked(new Set(candidates.map((c) => c.id)))}>Everyone ({candidates.length})</button>
        <button type="button" className="btn ghost sm" onClick={() => setPicked(new Set())}>None</button>
      </div>
      <div className="lrows" style={{ maxHeight: 420, overflowY: "auto" }}>
        {candidates.map((c) => (
          <label key={c.id} className="lrow" style={{ cursor: "pointer", gap: 12 }}>
            <input type="checkbox" name="studentId" value={c.id} checked={picked.has(c.id)} onChange={() => toggle(c.id)} style={{ width: 20, height: 20 }} />
            <span className="grow">
              <b>{c.name}</b>
              {c.detail && <span className="sub">{c.detail}</span>}
            </span>
            {c.ready && <span className="pill hong">Ready</span>}
          </label>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={pending || picked.size === 0}>{pending ? "Sending…" : `Invite ${picked.size} and email their families`}</button>
      </div>
    </form>
  );
}

/** Add someone yourself, e.g. they paid at the desk or don't use email. */
export function AddBookingForm({ action, candidates, fee }: { action: Action; candidates: Candidate[]; fee: string | null }) {
  const [state, run, pending] = useActionState<NoteState, FormData>(action, {});
  if (!candidates.length) return null;
  return (
    <form action={run} className="form" style={{ maxWidth: "none", marginTop: 12 }}>
      <Note state={state} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="add-student">Student</label>
          <select id="add-student" name="studentId" defaultValue="">
            <option value="" disabled>Choose one</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {fee && (
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" name="paid" /> Paid {fee} at the club
          </label>
        )}
        <button className="btn secondary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </div>
    </form>
  );
}

type Booking = { id: string; name: string; grade: string | null; outcome: string | null };

/** Results on the day. Passes become belts on each student's profile. */
export function ResultsForm({ action, bookings }: { action: Action; bookings: Booking[] }) {
  const [state, run, pending] = useActionState<NoteState, FormData>(action, {});
  return (
    <form action={run} style={{ marginTop: 12 }}>
      <Note state={state} />
      <div className="lrows">
        {bookings.map((b) => (
          <div key={b.id} className="lrow" style={{ flexWrap: "wrap", gap: 10 }}>
            <span className="grow" style={{ minWidth: 180 }}>
              <b>{b.name}</b>
              <span className="sub">{b.grade ? `For ${b.grade}` : ""}</span>
            </span>
            <label className="sr-only" htmlFor={`r-${b.id}`}>Result for {b.name}</label>
            <select id={`r-${b.id}`} name={`r_${b.id}`} defaultValue={b.outcome ?? ""} style={{ minWidth: 200, minHeight: 44, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", font: "inherit" }}>
              <option value="">No result yet</option>
              <option value="pass">Pass</option>
              <option value="merit">Pass with merit</option>
              <option value="distinction">Pass with distinction</option>
              <option value="fail">Not yet</option>
            </select>
          </div>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save results"}</button>
      </div>
    </form>
  );
}
