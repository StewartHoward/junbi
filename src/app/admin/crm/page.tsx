import Link from "next/link";
import type { Metadata } from "next";
import { STAGES, crmOverview, stageLabel } from "@/data/crm";
import { ebookBySlug } from "@/lib/ebooks";
import { AddContactForm, DeliverButton } from "./Forms";

export const metadata: Metadata = { title: "Leads · Junbi admin" };

const STAGE_PILL: Record<string, string> = { new: "neutral", contacted: "warn", demo: "warn", trial: "ok", customer: "ok", not_interested: "bad" };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const ago = (d: Date) => {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 30 ? `${days} days ago` : day(d);
};

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; book?: string }> }) {
  const sp = await searchParams;
  const { contacts, counts, byStage, books } = await crmOverview(sp);
  const today = new Date().toISOString().slice(0, 10);
  const href = (k: Partial<typeof sp>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...k }).filter(([, v]) => v) as Array<[string, string]>);
    return `/admin/crm${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <div className="phead">
        <div>
          <p className="eyebrow">Junbi Library and leads</p>
          <h1 className="ptitle">Leads</h1>
        </div>
        <div className="acts">
          <a href="/admin/crm/export" className="btn secondary sm">Download CSV</a>
          <Link href="/library" className="btn ghost sm" target="_blank">View the library</Link>
        </div>
      </div>

      <section className="kpis three anim" aria-label="Key numbers">
        <div className="card kpi"><p className="l">Leads</p><p className="v">{counts.total}</p><p className="s">{counts.week} new in the last 7 days</p></div>
        <div className="card kpi"><p className="l">Happy to get emails</p><p className="v">{counts.emailsOk}</p><p className="s">{counts.total ? Math.round((counts.emailsOk / counts.total) * 100) : 0}% of leads</p></div>
        <div className="card kpi"><p className="l">Signed up to Junbi</p><p className="v">{counts.signedUp}</p><p className="s">{counts.total ? Math.round((counts.signedUp / counts.total) * 100) : 0}% of leads</p></div>
        <div className="card kpi"><p className="l">Follow-ups due</p><p className={`v${counts.due ? " warn-t" : ""}`}>{counts.due}</p><p className="s">Today or overdue</p></div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Ebooks</h2><span className="m">Orders are free; each one adds a lead</span></div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead><tr><th scope="col">Ebook</th><th scope="col">Status</th><th scope="col">People</th><th scope="col">Downloads</th><th scope="col">Waiting</th><th scope="col"><span className="sr-only">Send</span></th></tr></thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.book.slug}>
                  <td><Link href={href({ book: b.book.slug })}><b>{b.book.title}</b></Link><span className="sub">{b.book.pages} pages</span></td>
                  <td><span className={`pill ${b.book.ready ? "ok" : "warn"}`}>{b.book.ready ? "Live" : "Pre-orders"}</span></td>
                  <td className="num">{b.people}</td>
                  <td className="num">{b.downloads}</td>
                  <td className="num">{b.waiting}</td>
                  <td><DeliverButton slug={b.book.slug} waiting={b.waiting} ready={b.book.ready} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch">
          <h2>People</h2>
          <form action="/admin/crm" role="search" style={{ display: "flex", gap: 8, flex: "1 1 220px", justifyContent: "flex-end" }}>
            {sp.stage && <input type="hidden" name="stage" value={sp.stage} />}
            {sp.book && <input type="hidden" name="book" value={sp.book} />}
            <label htmlFor="q" className="sr-only">Search leads</label>
            <input id="q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search name, club or email" style={{ minHeight: 40, width: "100%", maxWidth: 300 }} />
          </form>
        </div>
        <nav className="seg" aria-label="Stage" style={{ marginTop: 16 }}>
          <Link href={href({ stage: undefined })} aria-current={!sp.stage ? "true" : undefined}>All {counts.total}</Link>
          {STAGES.map((s) => <Link key={s.key} href={href({ stage: s.key })} aria-current={sp.stage === s.key ? "true" : undefined}>{s.label} {byStage[s.key] ?? 0}</Link>)}
        </nav>
        {sp.book && <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>Showing people who ordered {ebookBySlug(sp.book)?.title}. <Link href={href({ book: undefined })}>Show everyone</Link></p>}
        <div className="table-wrap admin-table" style={{ marginTop: 12 }}>
          <table className="data" style={{ minWidth: 960 }}>
            <thead><tr><th scope="col">Person</th><th scope="col">Stage</th><th scope="col">Club</th><th scope="col">Uses now</th><th scope="col">Ebooks</th><th scope="col">Next follow-up</th><th scope="col">Last activity</th></tr></thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/crm/${c.id}`}><b>{c.name || c.email}</b></Link><span className="sub">{c.email}{c.marketingOk && !c.unsubscribed ? " · emails OK" : ""}</span></td>
                  <td><span className={`pill ${STAGE_PILL[c.stage]}`}>{stageLabel(c.stage)}</span></td>
                  <td>{c.clubName || <span className="muted">No club yet</span>}<span className="sub">{[c.arts.join(", "), c.size].filter(Boolean).join(" · ")}</span></td>
                  <td>{c.system || <span className="muted">Unknown</span>}</td>
                  <td>{c.ordered.length ? c.ordered.map((s) => ebookBySlug(s)?.title ?? s).join(", ") : <span className="muted">Added by hand</span>}</td>
                  <td className={c.nextActionOn && c.nextActionOn <= today ? "warn-t" : undefined}>{c.nextActionOn ? day(new Date(`${c.nextActionOn}T12:00:00Z`)) : <span className="muted">None</span>}</td>
                  <td>{ago(c.lastActivity)}</td>
                </tr>
              ))}
              {contacts.length === 0 && <tr><td colSpan={7} className="muted">No leads yet. Every ebook order lands here.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-cards">
          {contacts.map((c) => (
            <Link href={`/admin/crm/${c.id}`} className="admin-club" key={c.id} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}><b>{c.name || c.email}</b><span className="sub" style={{ overflowWrap: "anywhere" }}>{c.clubName || "Not open yet"} · {c.email}</span></div>
                <span className={`pill ${STAGE_PILL[c.stage]}`}>{stageLabel(c.stage)}</span>
              </div>
              <p className="sub" style={{ marginTop: 8 }}>{c.nextActionOn ? `Follow up ${day(new Date(`${c.nextActionOn}T12:00:00Z`))}` : `Last activity ${ago(c.lastActivity).toLowerCase()}`}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Add a lead by hand</h2><span className="m">Met at an event, a phone call</span></div>
        <div style={{ marginTop: 12 }}><AddContactForm /></div>
      </section>
    </>
  );
}
