"use client";

import { useActionState } from "react";
import { addContactAction, addNoteAction, deliverEbookAction, updateContactAction, type CrmState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

const Msg = ({ s }: { s: CrmState }) => (s.errors?.form ? <p className="bad-t" role="alert" style={{ margin: "8px 0 0", fontSize: 14 }}>{s.errors.form}</p> : s.ok ? <p className="ok-t" role="status" style={{ margin: "8px 0 0", fontSize: 14 }}>{s.ok}</p> : null);

export function DeliverButton({ slug, waiting, ready }: { slug: string; waiting: number; ready: boolean }) {
  const [s, run, pending] = useActionState<CrmState>(deliverEbookAction.bind(null, slug), {});
  return (
    <form action={run}>
      <button type="submit" className="btn secondary sm" disabled={pending || !ready || waiting === 0} title={ready ? undefined : "Add the PDF and mark it ready first"}>
        {pending ? "Sending…" : ready ? `Send to ${waiting} waiting` : "Not ready yet"}
      </button>
      <Msg s={s} />
    </form>
  );
}

export function AddContactForm() {
  const [s, run, pending] = useActionState<CrmState, FormData>(addContactAction, {});
  const e = s.errors;
  return (
    <form action={run} className="form" style={{ maxWidth: "none", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
      <div><label htmlFor="c-name">Name</label><input id="c-name" name="name" required {...errProps("name", e)} /><FieldError id="name-err" msg={e?.name} /></div>
      <div><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" required {...errProps("email", e)} /><FieldError id="email-err" msg={e?.email} /></div>
      <div><label htmlFor="c-club">Club</label><input id="c-club" name="clubName" /></div>
      <div><label htmlFor="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" /></div>
      <div><button type="submit" className="btn primary" disabled={pending}>{pending ? "Adding…" : "Add lead"}</button></div>
    </form>
  );
}

export function EditContactForm({ id, stages, c }: { id: string; stages: Array<{ key: string; label: string }>; c: { stage: string; nextActionOn: string | null; name: string; clubName: string; phone: string } }) {
  const [s, run, pending] = useActionState<CrmState, FormData>(updateContactAction.bind(null, id), {});
  return (
    <form action={run} className="form" style={{ maxWidth: "none", display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={c.stage}>{stages.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
        <div><label htmlFor="nextActionOn">Next follow-up</label><input id="nextActionOn" name="nextActionOn" type="date" defaultValue={c.nextActionOn ?? ""} /></div>
        <div><label htmlFor="name">Name</label><input id="name" name="name" defaultValue={c.name} /></div>
        <div><label htmlFor="clubName">Club</label><input id="clubName" name="clubName" defaultValue={c.clubName} /></div>
        <div><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" defaultValue={c.phone} /></div>
      </div>
      <div><button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button><Msg s={s} /></div>
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [s, run, pending] = useActionState<CrmState, FormData>(addNoteAction.bind(null, id), {});
  return (
    <form action={run} className="form" style={{ maxWidth: "none" }} key={s.ok ? Date.now() : "note"}>
      <label htmlFor="note">Add a note</label>
      <textarea id="note" name="note" rows={3} placeholder="Called, wants a demo after half term…" {...errProps("note", s.errors)} />
      <FieldError id="note-err" msg={s.errors?.note} />
      <div style={{ marginTop: 10 }}><button type="submit" className="btn secondary" disabled={pending}>{pending ? "Adding…" : "Add note"}</button><Msg s={s} /></div>
    </form>
  );
}
