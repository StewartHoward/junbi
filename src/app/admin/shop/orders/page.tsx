import Link from "next/link";
import type { Metadata } from "next";
import { shopOrders } from "@/data/shop-admin";
import { ShopTabs, money } from "../ShopTabs";
import { OrderTable } from "../OrderTable";

export const metadata: Metadata = { title: "Orders · Shop · Junbi admin" };

const TABS = [["", "All"], ["paid", "Paid"], ["free", "Free"], ["pending", "Awaiting payment"], ["abandoned", "Abandoned"]] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; book?: string; q?: string }> }) {
  const sp = await searchParams;
  const { orders, counts, books } = await shopOrders(sp);
  const href = (k: Partial<typeof sp>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...k }).filter(([, v]) => v) as Array<[string, string]>);
    return `/admin/shop/orders${p.size ? `?${p}` : ""}`;
  };
  const total = orders.filter((o) => o.status === "paid").reduce((a, o) => a + o.amountPence, 0);
  return (
    <>
      <div className="phead">
        <div><p className="eyebrow">Junbi admin</p><h1 className="ptitle">Shop</h1></div>
        <div className="acts"><a href="/admin/shop/orders/export" className="btn secondary sm">Download CSV</a></div>
      </div>
      <ShopTabs on="orders" />

      <section className="card" style={{ marginTop: 20 }}>
        <div className="ch">
          <h2>Orders</h2>
          <form action="/admin/shop/orders" role="search" style={{ display: "flex", gap: 8, flex: "1 1 260px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <label htmlFor="book" className="sr-only">Ebook</label>
            <select id="book" name="book" defaultValue={sp.book ?? ""} style={{ minHeight: 40, maxWidth: 220 }}>
              <option value="">All ebooks</option>
              {books.map((b) => <option key={b.slug} value={b.slug}>{b.title}</option>)}
            </select>
            <label htmlFor="q" className="sr-only">Search orders</label>
            <input id="q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Order number, name or email" style={{ minHeight: 40, width: "100%", maxWidth: 260 }} />
            <button type="submit" className="btn secondary sm">Filter</button>
          </form>
        </div>
        <nav className="seg" aria-label="Status" style={{ marginTop: 16 }}>
          {TABS.map(([k, l]) => <Link key={k} href={href({ status: k || undefined })} aria-current={(sp.status ?? "") === k ? "true" : undefined}>{l} {counts?.[(k || "all") as keyof typeof counts] ?? 0}</Link>)}
        </nav>
        <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>
          {orders.length} {orders.length === 1 ? "order" : "orders"}{total ? ` · ${money(total)} paid` : ""}
          {(sp.book || sp.q) && <> · <Link href={href({ book: undefined, q: undefined })}>Clear filters</Link></>}
        </p>
        <OrderTable orders={orders} />
        <p className="muted" style={{ margin: "16px 0 0", fontSize: 13 }}>A card checkout that isn&apos;t paid within an hour shows as Abandoned. Click a customer to see their full history in Leads.</p>
      </section>
    </>
  );
}
