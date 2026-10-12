"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { previewAudienceAction, sendMessageAction, type SendState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import type { AudiencePreview } from "@/data/messages";

type Option = { id: string; name?: string; label?: string };

export function Compose({ sites, classes, allSites, initial }: { sites: Option[]; classes: Option[]; allSites: boolean; initial: { kind: string; siteId?: string; classId?: string } }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendMessageAction, {});
  const v = state.values ?? {};
  const e = state.errors;
  const [kind, setKind] = useState(v.kind || initial.kind);
  const [siteId, setSiteId] = useState(v.siteId || initial.siteId || sites[0]?.id || "");
  const [classId, setClassId] = useState(v.classId || initial.classId || classes[0]?.id || "");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [, startPreview] = useTransition();

  useEffect(() => {
    setConfirming(false);
    startPreview(async () => setPreview(await previewAudienceAction({ kind, siteId, classId })));
  }, [kind, siteId, classId]);

  const n = preview?.emails ?? 0;
  const families = (x: number) => `${x} ${x === 1 ? "family" : "families"}`;
  // One email per parent, so a family with two parents counts twice.
  const people = (x: number) => `${x} ${x === 1 ? "parent" : "parents"}`;

  return (
    <form action={action} className="card form" style={{ marginTop: 24, maxWidth: 760 }} noValidate onChange={() => setConfirming(false)}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}

      <fieldset>
        <legend style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Who&apos;s it for?</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="check">
            <input type="radio" name="kind" value="all" checked={kind === "all"} onChange={() => setKind("all")} />
            <span>{allSites ? "Everyone" : "Everyone at my sites"}</span>
          </label>
          {sites.length > 1 && (
            <label className="check" style={{ alignItems: "center" }}>
              <input type="radio" name="kind" value="site" checked={kind === "site"} onChange={() => setKind("site")} />
              <span>One site</span>
              {kind === "site" && (
                <select name="siteId" value={siteId} onChange={(ev) => setSiteId(ev.target.value)} aria-label="Site" style={{ marginLeft: 8, maxWidth: 260 }}>
                  {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              )}
            </label>
          )}
          {classes.length > 0 && (
            <label className="check" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <input type="radio" name="kind" value="class" checked={kind === "class"} onChange={() => setKind("class")} />
              <span>A class</span>
              {kind === "class" && (
                <select name="classId" value={classId} onChange={(ev) => setClassId(ev.target.value)} aria-label="Class" style={{ marginLeft: 8, maxWidth: 380 }}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
            </label>
          )}
        </div>
        <p className="hint" aria-live="polite" style={{ marginTop: 10 }}>
          {preview === null
            ? "Counting…"
            : kind === "class"
              ? `${people(n)} of students who've been to this class in the last 8 weeks.`
              : `${people(n)} of current students.`}
          {preview && preview.familiesWithoutEmail > 0 ? ` ${families(preview.familiesWithoutEmail)} have no email address, so they won't get it.` : ""}
        </p>
        <FieldError id="audience-err" msg={e?.audience} />
      </fieldset>

      <div>
        <label htmlFor="subject">Subject</label>
        <input id="subject" name="subject" maxLength={150} defaultValue={v.subject} placeholder="e.g. No classes on Bank Holiday Monday" {...errProps("subject", e)} />
        <FieldError id="subject-err" msg={e?.subject} />
      </div>
      <div>
        <label htmlFor="body">Message</label>
        <textarea id="body" name="body" rows={10} defaultValue={v.body} placeholder={"Hi everyone,\n\n…"} {...errProps("body", e)} style={{ minHeight: 220 }} />
        <FieldError id="body-err" msg={e?.body} />
        <p className="hint">Leave a blank line between paragraphs. Replies come back to your email.</p>
      </div>

      <div className="actions">
        {!confirming ? (
          <button key="ask" type="button" className="btn primary" disabled={!n || pending} onClick={(ev) => { ev.preventDefault(); setConfirming(true); }}>
            {n ? `Send to ${people(n)}` : "Send"}
          </button>
        ) : (
          <>
            <span role="status" style={{ fontSize: 14 }}>Ready to send?</span>
            <button key="confirm" type="submit" className="btn primary" disabled={pending}>{pending ? "Sending…" : `Yes, send to ${families(n)}`}</button>
            <button key="cancel" type="button" className="btn ghost" onClick={() => setConfirming(false)} disabled={pending}>Not yet</button>
          </>
        )}
      </div>
    </form>
  );
}
