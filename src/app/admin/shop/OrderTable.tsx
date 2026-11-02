import Link from "next/link";
import { ORDER_LABEL } from "@/data/shop-admin";
import { ORDER_PILL, money, when } from "./ShopTabs";

/** Orders as a table on wide screens and cards on phones. */
export function OrderTable({ orders }: { orders: Array<{ id: string; number: number; status: keyof typeof ORDER_LABEL; amountPence: number; createdAt: Date; contactId: string; name: string; email: string; clubName: string; titles: string[]; downloads: number }> }) {
  if (!orders.length) return <p className="muted" style={{ marginTop: 12 }}>No orders yet. They&apos;ll show here as soon as someone checks out.</p>;
  return (
    <>
      <div className="table-wrap admin-table" style={{ marginTop: 12 }}>
        <table className="data" style={{ minWidth: 860 }}>
          <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Ebooks</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Downloads</th><th scope="col">When</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="num"><b>{o.number}</b></td>
                <td><Link href={`/admin/crm/${o.contactId}`}><b>{o.name || o.email}</b></Link><span className="sub">{o.clubName ? `${o.clubName} · ` : ""}{o.email}</span></td>
                <td>{o.titles.join(", ")}</td>
                <td><span className={`pill ${ORDER_PILL[o.status]}`}>{ORDER_LABEL[o.status]}</span></td>
                <td className="num">{o.amountPence ? money(o.amountPence) : "£0"}</td>
                <td className="num">{o.downloads}</td>
                <td>{when(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-cards">
        {orders.map((o) => (
          <Link key={o.id} href={`/admin/crm/${o.contactId}`} className="admin-club" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}><b>Order {o.number} · {o.name || o.email}</b><span className="sub" style={{ overflowWrap: "anywhere" }}>{o.titles.join(", ")}</span></div>
              <span className={`pill ${ORDER_PILL[o.status]}`}>{ORDER_LABEL[o.status]}</span>
            </div>
            <p className="sub" style={{ marginTop: 8 }}>{o.amountPence ? money(o.amountPence) : "£0"} · {when(o.createdAt)} · {o.downloads} downloads</p>
          </Link>
        ))}
      </div>
    </>
  );
}
