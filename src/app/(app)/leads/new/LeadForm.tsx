"use client";

import { useActionState, useState } from "react";
import { addLeadAction, type LeadFormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { SessionFields } from "../SessionFields";

type Opts = { sites: Array<{ id: string; name: string }>; classes: Array<{ id: string; name: string; siteId: string; weekday: number; startsAt: string }>; sources: readonly string[] };

export function LeadForm({ opts }: { opts: Opts }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(addLeadAction, {});
  const v = state.values ?? {};
  const e = state.errors;
  const [site, setSite] = useState(v.siteId ?? (opts.sites.length === 1 ? opts.sites[0].id : ""));
  return (
    <form action={action} className="form" noValidate>
      <fieldset>
        <legend className="section-title">Who&apos;s getting in touch</legend>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" defaultValue={v.firstName} autoComplete="off" {...errProps("firstName", e)} />
            <FieldError id="firstName-err" msg={e?.firstName} />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" defaultValue={v.lastName} autoComplete="off" />
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 240px" }}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue={v.email} autoComplete="off" {...errProps("email", e)} />
            <FieldError id="email-err" msg={e?.email} />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" defaultValue={v.phone} autoComplete="off" />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>With an email, they get a welcome straight away and a reminder the day before their trial.</p>
      </fieldset>

      <fieldset>
        <legend className="section-title">Who&apos;s training</legend>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: "2 1 220px" }}>
            <label htmlFor="studentName">Child&apos;s name (leave empty if it&apos;s them)</label>
            <input id="studentName" name="studentName" defaultValue={v.studentName} autoComplete="off" />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label htmlFor="studentAge">Age</label>
            <input id="studentAge" name="studentAge" inputMode="numeric" defaultValue={v.studentAge} {...errProps("studentAge", e)} />
            <FieldError id="studentAge-err" msg={e?.studentAge} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="section-title">Trial session</legend>
        {opts.sites.length > 1 && (
          <div>
            <label htmlFor="siteId">Site</label>
            <select id="siteId" name="siteId" value={site} onChange={(ev) => setSite(ev.target.value)} {...errProps("siteId", e)}>
              <option value="">Any site</option>
              {opts.sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <FieldError id="siteId-err" msg={e?.siteId} />
          </div>
        )}
        {opts.sites.length === 1 && <input type="hidden" name="siteId" value={opts.sites[0].id} />}
        <SessionFields classes={opts.classes} siteId={site} values={v} errors={e} sites={opts.sites} />
      </fieldset>

      <fieldset>
        <legend className="section-title">Anything else</legend>
        <div>
          <label htmlFor="source">How did they hear about you?</label>
          <select id="source" name="source" defaultValue={v.source ?? ""}>
            <option value="">Not sure</option>
            {opts.sources.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="notes">Notes (staff only)</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={v.notes} />
        </div>
      </fieldset>

      {e?.form && <p className="banner" role="alert">{e.form}</p>}
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Adding…" : "Add lead"}</button>
      </div>
    </form>
  );
}
