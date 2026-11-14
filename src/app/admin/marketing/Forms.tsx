"use client";

import { useActionState, useTransition } from "react";
import { addProspectAction, importAction, newCampaignAction, prospectStatusAction, type MktState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";
import { SOURCES } from "@/lib/marketing-email";
import type { ProspectStatus } from "@/data/marketing";

export const Msg = ({ s }: { s: MktState }) =>
  s.errors?.form ? <p className="bad-t" role="alert" style={{ margin: "8px 0 0", fontSize: 14 }}>{s.errors.form}</p> : s.ok ? <p className="ok-t" role="status" style={{ margin: "8px 0 0", fontSize: 14 }}>{s.ok}</p> : null;

export function NewCampaignButtons() {
  const [pending, start] = useTransition();
  return (
    <div className="acts" style={{ flexWrap: "wrap" }}>
      <button type="button" className="btn primary sm" disabled={pending} onClick={() => start(() => newCampaignAction("trial-sequence"))}>
        {pending ? "Setting up…" : "Use the 7-day trial campaign"}
      </button>
      <button type="button" className="btn secondary sm" disabled={pending} onClick={() => start(() => newCampaignAction(""))}>New blank email</button>
    </div>
  );
}

export function ImportForm() {
  const [s, run, pending] = useActionState<MktState, FormData>(importAction, {});
  const e = s.errors;
  return (
    <form action={run} className="form" style={{ maxWidth: "none" }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <label htmlFor="m-file">CSV file</label>
          <input id="m-file" name="file" type="file" accept=".csv,text/csv,.tsv,.txt" />
          <p className="hint">Needs an Email column. Club, Phone, Website, Town, Region, Style (WT or ITF) and Source are picked up if they&apos;re there.</p>
        </div>
        <div>
          <label htmlFor="m-source">Where these came from</label>
          <select id="m-source" name="source" defaultValue="british-taekwondo">{SOURCES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
          <p className="hint">Used when a row has no Source. It sets the &ldquo;why you&apos;re getting this&rdquo; line in each email.</p>
        </div>
        <div>
          <label htmlFor="m-style">Style</label>
          <select id="m-style" name="style" defaultValue=""><option value="">From the file (or unknown)</option><option value="WT">WT</option><option value="ITF">ITF</option></select>
        </div>
      </div>
      <div>
        <label htmlFor="m-csv">Or paste rows</label>
        <textarea id="m-csv" name="csv" rows={4} placeholder={"Club,Email,Style\nRiverside Taekwondo,info@riverside.example,WT"} {...errProps("csv", e)} />
        <FieldError id="csv-err" msg={e?.csv} />
      </div>
      <div><button type="submit" className="btn primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button><Msg s={s} /></div>
    </form>
  );
}

export function AddProspectForm() {
  const [s, run, pending] = useActionState<MktState, FormData>(addProspectAction, {});
  const e = s.errors;
  return (
    <form action={run} className="form" style={{ maxWidth: "none", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end" }} key={s.ok ? Date.now() : "add"}>
      <div><label htmlFor="p-club">Club</label><input id="p-club" name="clubName" /></div>
      <div><label htmlFor="p-email">Email</label><input id="p-email" name="email" type="email" required {...errProps("email", e)} /><FieldError id="email-err" msg={e?.email} /></div>
      <div><label htmlFor="p-name">Contact name</label><input id="p-name" name="contactName" /></div>
      <div><label htmlFor="p-town">Town</label><input id="p-town" name="town" /></div>
      <div><label htmlFor="p-st">Style</label><select id="p-st" name="style" defaultValue=""><option value="">Unknown</option><option value="WT">WT</option><option value="ITF">ITF</option></select></div>
      <div><button type="submit" className="btn secondary" disabled={pending}>{pending ? "Adding…" : "Add club"}</button><Msg s={s} /></div>
    </form>
  );
}

export function StatusSelect({ id, status }: { id: string; status: ProspectStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Email status"
      defaultValue={status}
      disabled={pending || status === "unsubscribed"}
      title={status === "unsubscribed" ? "They unsubscribed. Only add them back if they ask." : undefined}
      onChange={(ev) => start(() => prospectStatusAction(id, ev.target.value as ProspectStatus))}
      style={{ minHeight: 36, fontSize: 14 }}
    >
      <option value="active">Can email</option>
      <option value="do_not_email">Do not email</option>
      <option value="bounced">Bounced</option>
      {status === "unsubscribed" && <option value="unsubscribed">Unsubscribed</option>}
    </select>
  );
}
