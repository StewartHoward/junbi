import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STAGES, crmContact, stageLabel } from "@/data/crm";
import { ebookBySlug } from "@/lib/ebooks";
import { EditContactForm, NoteForm } from "../Forms";

export const metadata: Metadata = { title: "Lead · Junbi admin" };

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const KIND: Record<string, string> = { order: "Order", delivered: "Ebook sent", download: "Download", email: "Email", note: "Note", stage: "Stage", signup: "Signed up", unsubscribe: "Unsubscribed", edit: "Follow-up" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await crmContact((await params).id);
  if (!data) notFound();
  const { contact: c, events } = data;
  const facts: Array<[string, React.ReactNode]> = [
    ["Email", <a key="e" href={`mailto:${c.email}`}>{c.email}</a>],
    ["Phone", c.phone ? <a key="p" href={`tel:${c.phone}`}>{c.phone}</a> : <span className="muted">Not given</span>],
    ["Role", c.role || "Unknown"],
    ["Teaches", c.arts.join(", ") || "Unknown"],
    ["Size", c.size || "Unknown"],
    ["Uses now", c.system || "Unknown"],
    ["Ebooks", c.ordered.map((s) => ebookBySlug(s)?.title ?? s).join(", ") || "None"],
    ["Emails", c.unsubscribed ? "Unsubscribed" : c.marketingOk ? `Yes${c.followupStep ? `, ${c.followupStep} of 3 follow-ups sent` : ""}` : "No, order emails only"],
    ["Junbi", c.signedUp ? "Signed up" : "Not signed up"],
    ["Added", when(c.createdAt)],
  ];
  return (
    <>
      <p style={{ margin: 0, fontSize: 14 }}><Link href="/admin/crm">‹ Leads</Link></p>
      <div className="phead" style={{ marginTop: 8 }}>
        <div>
          <p className="eyebrow">{stageLabel(c.stage)}</p>
          <h1 className="ptitle">{c.name || c.email}</h1>
          {c.clubName && <p className="muted" style={{ margin: "4px 0 0" }}>{c.clubName}</p>}
        </div>
        <div className="acts"><a href={`mailto:${c.email}`} className="btn primary sm">Email</a></div>
      </div>

      <div className="g2" style={{ marginTop: 20, alignItems: "start" }}>
        <section className="card">
          <div className="ch"><h2>Details</h2></div>
          <dl style={{ margin: "12px 0 0", display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 16px", fontSize: 15 }}>
            {facts.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt className="muted">{k}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{v}</dd></div>)}
          </dl>
        </section>
        <section className="card">
          <div className="ch"><h2>Update</h2></div>
          <div style={{ marginTop: 12 }}><EditContactForm key={`${c.stage}-${c.nextActionOn}`} id={c.id} stages={[...STAGES]} c={c} /></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Timeline</h2><span className="m">Newest first</span></div>
        <div style={{ marginTop: 12 }}><NoteForm id={c.id} /></div>
        <ol style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
          {events.map((e) => (
            <li key={e.id} style={{ padding: "12px 0", borderTop: "1px solid var(--line, #e5e5ea)", display: "grid", gridTemplateColumns: "minmax(110px, max-content) 1fr", gap: 12 }}>
              <span className="muted" style={{ fontSize: 13 }}>{KIND[e.kind] ?? e.kind}<br />{when(e.at)}</span>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{e.detail}{e.by ? <span className="muted" style={{ fontSize: 13 }}> · {e.by}</span> : null}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
