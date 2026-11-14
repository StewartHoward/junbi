"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { controlAction, saveCampaignAction, type MktState } from "../actions";
import { Msg } from "../Forms";
import { FieldError, errProps } from "@/components/FormBits";
import { MERGE_FIELDS, SOURCES, reasonFor, renderMarketingEmail, type MarketingContent, type MergeVars } from "@/lib/marketing-email";

type Props = {
  id: string;
  name: string;
  content: MarketingContent;
  audienceStyle: string;
  audienceSource: string;
  followsId: string | null;
  delayDays: number;
  dailyLimit: number;
  status: "draft" | "sending" | "paused" | "sent";
  others: Array<{ id: string; name: string }>;
  sample: MergeVars & { source: string };
  adminEmail: string;
};

export function Editor(p: Props) {
  const [s, run, pending] = useActionState<MktState, FormData>(saveCampaignAction.bind(null, p.id), {});
  const [c, setC] = useState<MarketingContent>(p.content);
  const [follows, setFollows] = useState(p.followsId ?? "");
  const [view, setView] = useState<"desktop" | "phone">("desktop");
  const body = useRef<HTMLTextAreaElement>(null);
  const locked = p.status === "sending" || p.status === "sent";
  const e = s.errors;

  const preview = useMemo(() => renderMarketingEmail(c, p.sample, { unsubscribeUrl: "#", reason: reasonFor(p.sample.source) }), [c, p.sample]);
  const set = (k: keyof MarketingContent) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: ev.target.value });
  const insert = (tag: string) => {
    const el = body.current;
    if (!el) return;
    const at = el.selectionStart ?? c.body.length;
    const next = c.body.slice(0, at) + tag + c.body.slice(el.selectionEnd ?? at);
    setC({ ...c, body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at + tag.length, at + tag.length); });
  };

  return (
    <div className="g2" style={{ alignItems: "start", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      <form action={run} className="form card" style={{ maxWidth: "none" }}>
        <fieldset disabled={locked}>
          <legend>The email</legend>
          <div><label htmlFor="name">Name (only you see this)</label><input id="name" name="name" defaultValue={p.name} {...errProps("name", e)} /><FieldError id="name-err" msg={e?.name} /></div>
          <div>
            <label htmlFor="subject">Subject line</label>
            <input id="subject" name="subject" value={c.subject} onChange={set("subject")} maxLength={150} {...errProps("subject", e)} />
            <p className="hint">{c.subject.length} characters. Under 50 reads best on a phone.</p>
            <FieldError id="subject-err" msg={e?.subject} />
          </div>
          <div><label htmlFor="preheader">Preview text</label><input id="preheader" name="preheader" value={c.preheader} onChange={set("preheader")} maxLength={200} /><p className="hint">The grey line after the subject in most inboxes.</p></div>
          <div><label htmlFor="heading">Heading</label><input id="heading" name="heading" value={c.heading} onChange={set("heading")} maxLength={150} /></div>
          <div>
            <label htmlFor="body">Message</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} aria-label="Insert a merge field">
              {MERGE_FIELDS.map((f) => <button key={f.tag} type="button" className="btn ghost sm" style={{ minHeight: 32 }} onClick={() => insert(f.tag)}>+ {f.label}</button>)}
            </div>
            <textarea ref={body} id="body" name="body" rows={16} value={c.body} onChange={set("body")} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14 }} {...errProps("body", e)} />
            <p className="hint">Blank line for a new paragraph. Start lines with &ldquo;- &rdquo; for a list, or &ldquo;|&rdquo; for a table. **Bold** and *italic* work. The unsubscribe link and results statement are added for you.</p>
            <FieldError id="body-err" msg={e?.body} />
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1.4fr" }}>
            <div><label htmlFor="buttonLabel">Button text</label><input id="buttonLabel" name="buttonLabel" value={c.buttonLabel} onChange={set("buttonLabel")} maxLength={60} /></div>
            <div><label htmlFor="buttonUrl">Button link</label><input id="buttonUrl" name="buttonUrl" type="url" value={c.buttonUrl} onChange={set("buttonUrl")} placeholder="https://junbi.co.uk/signup" {...errProps("buttonUrl", e)} /><FieldError id="buttonUrl-err" msg={e?.buttonUrl} /></div>
          </div>
        </fieldset>

        <fieldset disabled={locked}>
          <legend>Who gets it</legend>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <div><label htmlFor="audienceStyle">Clubs</label><select id="audienceStyle" name="audienceStyle" defaultValue={p.audienceStyle}><option value="all">WT and ITF</option><option value="WT">WT only</option><option value="ITF">ITF only</option></select></div>
            <div><label htmlFor="audienceSource">From</label><select id="audienceSource" name="audienceSource" defaultValue={p.audienceSource}><option value="">Any source</option>{SOURCES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
            <div><label htmlFor="dailyLimit">Most per day</label><input id="dailyLimit" name="dailyLimit" type="number" min={1} max={2000} defaultValue={p.dailyLimit} {...errProps("dailyLimit", e)} /><FieldError id="dailyLimit-err" msg={e?.dailyLimit} /></div>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr" }}>
            <div>
              <label htmlFor="followsId">Send as a follow-up to</label>
              <select id="followsId" name="followsId" value={follows} onChange={(ev) => setFollows(ev.target.value)}>
                <option value="">Nothing, it&apos;s a first email</option>
                {p.others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <p className="hint">A follow-up only goes to clubs the earlier email reached, and skips anyone who unsubscribed or signed up.</p>
            </div>
            <div><label htmlFor="delayDays">Days after</label><input id="delayDays" name="delayDays" type="number" min={0} max={60} defaultValue={p.delayDays} disabled={!follows} /></div>
          </div>
          <p className="hint" style={{ margin: 0 }}>Start new sending addresses slowly: around 50 a day for the first week, then raise it.</p>
        </fieldset>

        {!locked && (
          <fieldset>
            <legend>Save and test</legend>
            <div><label htmlFor="testTo">Send the test to</label><input id="testTo" name="testTo" type="email" defaultValue={p.adminEmail} {...errProps("testTo", e)} /><FieldError id="testTo-err" msg={e?.testTo} /></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" name="intent" value="test" className="btn primary" disabled={pending}>{pending ? "Working…" : "Save and send me a test"}</button>
              <button type="submit" name="intent" value="save" className="btn secondary" disabled={pending}>Save</button>
            </div>
          </fieldset>
        )}
        <Msg s={s} />
        {locked && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{p.status === "sent" ? "This email has finished. Duplicate it to send something similar." : "Pause sending to make changes."}</p>}
      </form>

      <section className="card" aria-label="Preview" style={{ position: "sticky", top: 16 }}>
        <div className="ch">
          <h2>Preview</h2>
          <nav className="seg" aria-label="Preview size">
            <a href="#" aria-current={view === "desktop" ? "true" : undefined} onClick={(ev) => { ev.preventDefault(); setView("desktop"); }}>Desktop</a>
            <a href="#" aria-current={view === "phone" ? "true" : undefined} onClick={(ev) => { ev.preventDefault(); setView("phone"); }}>Phone</a>
          </nav>
        </div>
        <div style={{ margin: "12px 0 8px", fontSize: 14 }}>
          <div><b>{preview.subject}</b></div>
          <div className="muted">Stewart at Junbi · {c.preheader ? preview.html.match(/display:none[^>]*>([^<&]*)/)?.[1] : "No preview text"}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Filled in for {p.sample.clubName || "a sample club"}</div>
        </div>
        <iframe
          title="Email preview"
          srcDoc={preview.html}
          sandbox=""
          style={{ width: view === "phone" ? 375 : "100%", maxWidth: "100%", height: 720, border: "1px solid var(--line, #e5e5ea)", borderRadius: 12, display: "block", margin: "0 auto", background: "#f5f5f7" }}
        />
      </section>
    </div>
  );
}

export function Controls({ id, status, canStart, readyNow }: { id: string; status: Props["status"]; canStart: boolean; readyNow: number }) {
  const [start, runStart, p1] = useActionState<MktState>(controlAction.bind(null, id, "start"), {});
  const [pause, runPause, p2] = useActionState<MktState>(controlAction.bind(null, id, "pause"), {});
  const [batch, runBatch, p3] = useActionState<MktState>(controlAction.bind(null, id, "batch"), {});
  const [dup, runDup, p4] = useActionState<MktState>(controlAction.bind(null, id, "duplicate"), {});
  const [del, runDel, p5] = useActionState<MktState>(controlAction.bind(null, id, "delete"), {});
  const [sure, setSure] = useState(false);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(status === "draft" || status === "paused") && (
        <form action={runStart} style={{ display: "grid", gap: 10 }}>
          <label className="check" style={{ display: "flex", gap: 10, fontSize: 14 }}>
            <input type="checkbox" checked={sure} onChange={(ev) => setSure(ev.target.checked)} style={{ width: 20, height: 20 }} />
            <span>I&apos;ve checked the test email on my phone, and the links work.</span>
          </label>
          <div><button type="submit" className="btn primary" disabled={!sure || !canStart || p1}>{p1 ? "Starting…" : status === "paused" ? "Resume sending" : "Start sending"}</button></div>
          {!canStart && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Save and send yourself a test of this version first.</p>}
          <Msg s={start} />
        </form>
      )}
      {status === "sending" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <form action={runBatch}><button type="submit" className="btn primary sm" disabled={p3 || readyNow === 0}>{p3 ? "Sending…" : "Send the next batch now"}</button></form>
          <form action={runPause}><button type="submit" className="btn secondary sm" disabled={p2}>Pause</button></form>
        </div>
      )}
      <Msg s={batch} />
      <Msg s={pause} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <form action={runDup}><button type="submit" className="btn ghost sm" disabled={p4}>Duplicate</button></form>
        {status === "draft" && <form action={runDel}><button type="submit" className="btn ghost sm bad-t" disabled={p5}>Delete draft</button></form>}
      </div>
      <Msg s={dup} />
      <Msg s={del} />
    </div>
  );
}
