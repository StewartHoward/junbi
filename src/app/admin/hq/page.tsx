import Link from "next/link";
import type { Metadata } from "next";
import { allEbooks, ebookStats } from "@/data/library";
import { STATUS_LABEL, formatPrice } from "@/lib/ebooks";
import { Cover } from "@/app/(marketing)/library/Cover";
import "@/app/(marketing)/marketing.css";

export const metadata: Metadata = { title: "HQ · Junbi admin" };

const PILL = { draft: "neutral", preorder: "warn", live: "ok" } as const;

export default async function HqPage() {
  const [books, stats] = await Promise.all([allEbooks(), ebookStats()]);
  const stat = (slug: string) => stats.find((s) => s.slug === slug) ?? { people: 0, waiting: 0, revenue: 0, downloads: 0 };
  const orders = stats.reduce((a, s) => a + s.people, 0);
  const downloads = stats.reduce((a, s) => a + s.downloads, 0);
  return (
    <>
      <div className="phead">
        <div>
          <p className="eyebrow">Junbi HQ</p>
          <h1 className="ptitle">Library shop</h1>
        </div>
        <div className="acts">
          <Link href="/library" className="btn ghost sm" target="_blank">View the shop</Link>
          <Link href="/admin/hq/new" className="btn primary sm">New ebook</Link>
        </div>
      </div>

      <section className="kpis three anim" aria-label="Key numbers">
        <div className="card kpi"><p className="l">Ebooks</p><p className="v">{books.length}</p><p className="s">{books.filter((b) => b.status === "live").length} live · {books.filter((b) => b.status === "preorder").length} pre-order · {books.filter((b) => b.status === "draft").length} draft</p></div>
        <div className="card kpi"><p className="l">Orders</p><p className="v">{orders}</p><p className="s">Each one adds a lead</p></div>
        <div className="card kpi"><p className="l">Downloads</p><p className="v">{downloads}</p><p className="s"><Link href="/admin/crm">See the leads</Link></p></div>
      </section>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Ebooks</h2><span className="m">In shop order</span></div>
        {books.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No ebooks yet. <Link href="/admin/hq/new">Add the first one</Link>.</p>}
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {books.map((b) => {
            const s = stat(b.slug);
            return (
              <li key={b.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--line, #e5e5ea)", flexWrap: "wrap" }}>
                <Cover book={b} size="xs" />
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <Link href={`/admin/hq/${b.id}`}><b>{b.title}</b></Link>
                  <span className="sub" style={{ display: "block" }}>junbi.co.uk/library/{b.slug}{b.pdf ? " · PDF uploaded" : " · No PDF yet"}</span>
                </div>
                <span className={`pill ${PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                <span style={{ minWidth: 90, textAlign: "right" }}>
                  {b.worthPence ? <s className="muted" style={{ marginRight: 6 }}>{formatPrice(b.worthPence)}</s> : null}
                  <b>{formatPrice(b.pricePence)}</b>
                </span>
                <span className="muted" style={{ fontSize: 14, minWidth: 170 }}>{s.people} ordered · {s.downloads} downloads{s.waiting && b.status !== "live" ? ` · ${s.waiting} waiting` : ""}</span>
                <Link href={`/admin/hq/${b.id}`} className="btn secondary sm">Edit</Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
