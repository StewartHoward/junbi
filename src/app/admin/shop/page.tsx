import Link from "next/link";
import type { Metadata } from "next";
import { shopDashboard } from "@/data/shop-admin";
import { ShopTabs, money } from "./ShopTabs";
import { OrderTable } from "./OrderTable";

export const metadata: Metadata = { title: "Shop · Junbi admin" };

export default async function ShopOverview() {
  const d = await shopDashboard();
  const k = d.kpi;
  const maxDay = Math.max(1, ...d.days.map((x) => x.n));
  const maxSeller = Math.max(1, ...d.sellers.map((s) => s.orders));
  const label = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <>
      <div className="phead">
        <div><p className="eyebrow">Junbi admin</p><h1 className="ptitle">Shop</h1></div>
        <div className="acts">
          <Link href="/library" className="btn ghost sm" target="_blank">View the shop</Link>
          <Link href="/admin/shop/new" className="btn primary sm">New ebook</Link>
        </div>
      </div>
      <ShopTabs on="overview" />
      {!d.ready && <p className="warn-t" style={{ marginTop: 16 }}>The shop&apos;s database tables aren&apos;t set up yet.</p>}

      <section className="kpis anim" aria-label="Key numbers">
        <div className="card kpi"><p className="l">Orders</p><p className="v">{k.orders ?? 0}</p><p className="s">{k.today ?? 0} today · {k.week ?? 0} this week</p></div>
        <div className="card kpi"><p className="l">Money taken</p><p className="v">{money(k.revenue ?? 0)}</p><p className="s">{money(k.revenue30 ?? 0)} in the last 30 days</p></div>
        <div className="card kpi"><p className="l">Free · Paid</p><p className="v">{k.free ?? 0} · {k.paid ?? 0}</p><p className="s">{k.customers ?? 0} {k.customers === 1 ? "person" : "people"} in total</p></div>
        <div className="card kpi"><p className="l">Downloads</p><p className="v">{k.downloads ?? 0}</p><p className="s">{k.downloads30 ?? 0} in the last 30 days</p></div>
        <div className="card kpi"><p className="l">Unpaid checkouts</p><p className={`v${k.abandoned ? " warn-t" : ""}`}>{k.abandoned ?? 0}</p><p className="s">{k.waiting ? `${k.waiting} paying right now` : <Link href="/admin/shop/orders?status=abandoned">Started but not paid</Link>}</p></div>
      </section>

      <div className="g2 anim" style={{ marginTop: 24 }}>
        <section className="card">
          <div className="ch"><h2>Orders</h2><span className="m">Last 30 days</span></div>
          <div className="cols-chart dense" role="img" aria-label={`Orders each day for the last 30 days: ${d.days.map((x) => `${label(x.day)} ${x.n}`).join(", ")}`}>
            {d.days.map((x) => <span key={x.day} className={x.n ? undefined : "zero"} style={{ height: `${x.n ? Math.max(6, Math.round((x.n / maxDay) * 100)) : 1}%` }} title={`${label(x.day)}: ${x.n} ${x.n === 1 ? "order" : "orders"}${x.pence ? `, ${money(x.pence)}` : ""}`} />)}
          </div>
          <div className="axis" aria-hidden="true">{d.days.map((x, i) => <span key={x.day}>{i % 7 === 0 || i === d.days.length - 1 ? label(x.day) : ""}</span>)}</div>
        </section>
        <section className="card">
          <div className="ch"><h2>Best sellers</h2><span className="m">All time</span></div>
          {d.sellers.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No orders yet.</p>}
          {d.sellers.map((s) => (
            <div className="hbar" key={s.slug}>
              <span className="lab" title={s.title}>{s.title}</span>
              <span className="trk"><i style={{ width: `${Math.round((s.orders / maxSeller) * 100)}%` }} /></span>
              <span className="num">{s.orders}</span>
            </div>
          ))}
          {d.sellers.length > 0 && <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>Orders per ebook. {d.sellers.reduce((a, s) => a + s.downloads, 0)} downloads in total.</p>}
        </section>
      </div>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Latest orders</h2><span className="m"><Link href="/admin/shop/orders">See all orders</Link></span></div>
        <OrderTable orders={d.recent} />
      </section>
    </>
  );
}
