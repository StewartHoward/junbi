import Link from "next/link";
import type { Metadata } from "next";
import { PROSPECT_STATUSES, marketingOverview } from "@/data/marketing";
import { SOURCES, sourceLabel } from "@/lib/marketing-email";
import { AddProspectForm, ImportForm, NewCampaignButtons, StatusSelect } from "./Forms";

export const metadata: Metadata = { title: "Marketing · Junbi admin" };

const STATUS_PILL: Record<string, [string, string]> = { draft: ["neutral", "Draft"], sending: ["warn", "Sending"], paused: ["bad", "Paused"], sent: ["ok", "Sent"] };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ q?: string; style?: string; source?: string; status?: string }> }) {
  const sp = await searchParams;
  const { counts, prospects, campaigns } = await marketingOverview(sp);
  const href = (k: Partial<typeof sp>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...k }).filter(([, v]) => v) as Array<[string, string]>);
    return `/admin/marketing${p.size ? `?${p}` : ""}#clubs`;
  };
  return (
    <>
      <div className="phead">
        <div>
          <p className="eyebrow">Emails to clubs</p>
          <h1 className="ptitle">Marketing</h1>
        </div>
        <NewCampaignButtons />
      </div>

      <section className="kpis three anim" aria-label="Key numbers">
        <div className="card kpi"><p className="l">Clubs on the list</p><p className="v">{counts.total}</p><p className="s">{counts.wt} WT · {counts.itf} ITF</p></div>
        <div className="card kpi"><p className="l">Can email</p><p className="v">{counts.active}</p><p className="s">{counts.unsubscribed} unsubscribed</p></div>
        <div className="card kpi"><p className="l">Emails sent</p><p className="v">{counts.sent}</p><p className="s">Across every campaign</p></div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Emails</h2><span className="m">Write, test, then send a few at a time</span></div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Goes to</th><th scope="col">Sent</th><th scope="col">Still to go</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/marketing/${c.id}`}><b>{c.name}</b></Link><span className="sub">{c.subject || "No subject yet"}</span></td>
                  <td><span className={`pill ${STATUS_PILL[c.status][0]}`}>{STATUS_PILL[c.status][1]}</span></td>
                  <td>{c.followsName ? <>{c.delayDays} days after &ldquo;{c.followsName}&rdquo;</> : c.audienceStyle === "all" ? "Every club" : `${c.audienceStyle} clubs`}<span className="sub">Up to {c.dailyLimit} a day</span></td>
                  <td className="num">{c.sent}{c.failed ? <span className="sub bad-t">{c.failed} failed</span> : null}</td>
                  <td className="num">{c.status === "sent" ? <span className="muted">Finished {c.finishedAt ? day(c.finishedAt) : ""}</span> : c.remaining}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={5} className="muted">No emails yet. Start with the 7-day trial campaign: three emails, already written, with the price comparison.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }} id="clubs">
        <div className="ch">
          <h2>Clubs</h2>
          <form action="/admin/marketing" role="search" style={{ display: "flex", gap: 8, flex: "1 1 220px", justifyContent: "flex-end" }}>
            {sp.style && <input type="hidden" name="style" value={sp.style} />}
            {sp.source && <input type="hidden" name="source" value={sp.source} />}
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <label htmlFor="q" className="sr-only">Search clubs</label>
            <input id="q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search club, email or town" style={{ minHeight: 40, width: "100%", maxWidth: 300 }} />
          </form>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <nav className="seg" aria-label="Style">
            <Link href={href({ style: undefined })} aria-current={!sp.style ? "true" : undefined}>All</Link>
            <Link href={href({ style: "WT" })} aria-current={sp.style === "WT" ? "true" : undefined}>WT</Link>
            <Link href={href({ style: "ITF" })} aria-current={sp.style === "ITF" ? "true" : undefined}>ITF</Link>
          </nav>
          <nav className="seg" aria-label="Email status">
            <Link href={href({ status: undefined })} aria-current={!sp.status ? "true" : undefined}>Any status</Link>
            {PROSPECT_STATUSES.map((s) => <Link key={s.key} href={href({ status: s.key })} aria-current={sp.status === s.key ? "true" : undefined}>{s.label}</Link>)}
          </nav>
          <a href="/admin/marketing/export" className="btn ghost sm" style={{ marginLeft: "auto" }}>Download CSV</a>
        </div>
        {sp.source && <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>From {sourceLabel(sp.source)}. <Link href={href({ source: undefined })}>Show every source</Link></p>}
        <div className="table-wrap admin-table" style={{ marginTop: 12 }}>
          <table className="data" style={{ minWidth: 900 }}>
            <thead><tr><th scope="col">Club</th><th scope="col">Style</th><th scope="col">Phone and website</th><th scope="col">Source</th><th scope="col">Emails</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.clubName || p.email}</b><span className="sub" style={{ overflowWrap: "anywhere" }}>{p.email}{p.venues > 1 ? ` · ${p.venues} venues` : ""}{p.town ? ` · ${p.town}` : ""}</span></td>
                  <td>{p.style || <span className="muted">Unknown</span>}</td>
                  <td>{p.phone || <span className="muted">No phone</span>}<span className="sub" style={{ overflowWrap: "anywhere" }}>{p.website}</span></td>
                  <td><Link href={href({ source: p.source })}>{sourceLabel(p.source)}</Link></td>
                  <td className="num">{p.emailsSent}{p.lastEmailed && <span className="sub">Last {day(p.lastEmailed)}</span>}</td>
                  <td><StatusSelect id={p.id} status={p.status} /></td>
                </tr>
              ))}
              {prospects.length === 0 && <tr><td colSpan={6} className="muted">No clubs here yet. Import the club list below.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-cards">
          {prospects.map((p) => (
            <div className="admin-club" key={p.id}>
              <b>{p.clubName || p.email}</b>
              <span className="sub" style={{ overflowWrap: "anywhere" }}>{[p.style, p.email, p.town].filter(Boolean).join(" · ")}</span>
              <div style={{ marginTop: 8 }}><StatusSelect id={p.id} status={p.status} /></div>
            </div>
          ))}
        </div>
        {prospects.length === 500 && <p className="muted" style={{ fontSize: 14 }}>Showing the first 500. Search or filter to find others.</p>}
      </section>

      <div className="g2" style={{ marginTop: 24, alignItems: "start" }}>
        <section className="card">
          <div className="ch"><h2>Import clubs</h2><span className="m">CSV from a spreadsheet</span></div>
          <div style={{ marginTop: 12 }}><ImportForm /></div>
        </section>
        <section className="card">
          <div className="ch"><h2>Add a club by hand</h2></div>
          <div style={{ marginTop: 12 }}><AddProspectForm /></div>
          <h3 style={{ fontSize: 15, margin: "24px 0 6px" }}>Before you send</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
            <li>Every email says where we found the club and has an unsubscribe link. Unsubscribes are permanent.</li>
            <li>Clubs already on Junbi, on trial, or who said no in the Library are skipped automatically.</li>
            <li>Many club addresses belong to sole traders, who under UK rules (PECR) should have agreed to marketing email. Keep each email personal and relevant, and stop at the first &ldquo;no&rdquo;.</li>
            <li>Sources: {SOURCES.map((s) => s.label).join(", ")}.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
