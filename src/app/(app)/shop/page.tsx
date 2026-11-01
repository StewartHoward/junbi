import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listOrders, listProducts } from "@/data/shop";
import { getClubOverview } from "@/data/club";
import { appUrl } from "@/lib/email";
import { orderStatusAction, productActiveAction, saveProductAction } from "./actions";
import { ProductForm } from "./ProductForm";
import { CopyLink } from "./CopyLink";

export const metadata: Metadata = { title: "Shop" };

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Paying now", tone: "neutral" },
  paid: { label: "✓ Paid", tone: "ok" },
  to_pay: { label: "To pay at the club", tone: "warn" },
  handed_over: { label: "Handed over", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default async function ShopPage() {
  const actor = await requireActor();
  if (!can(actor, "payments.manage")) redirect("/today");
  const [products, orders, o] = await Promise.all([listProducts(actor), listOrders(actor), getClubOverview(actor)]);
  const shopUrl = `${await appUrl()}/c/${o.club.slug}/shop`;
  const toSort = orders.filter((x) => x.status === "paid" || x.status === "to_pay");
  const done = orders.filter((x) => x.status !== "paid" && x.status !== "to_pay" && x.status !== "pending");

  return (
    <>
      <h1 className="page-title">Shop</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
        Sell uniforms, kit and anything else. Families order from your shop page and pay by card through your Stripe, or pay at the club if you don&apos;t take card payments.
      </p>

      {products.some((p) => p.active) && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title">Your shop page</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Share it with families, add it to your website, or put it in a message. Parents also see it when they sign in.</p>
          <CopyLink url={shopUrl} />
        </section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <div className="ch"><h2>Orders to sort</h2><span className="m">{toSort.length}</span></div>
        {toSort.length === 0 ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Nothing waiting.</p>
        ) : (
          <div className="lrows" style={{ marginTop: 8 }}>
            {toSort.map((x) => (
              <div key={x.id} className="lrow" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                <span className="grow" style={{ minWidth: 220 }}>
                  <b>{x.name}</b> <span className="muted" style={{ fontSize: 13 }}>· {x.when}</span>
                  <span className="sub">{x.items.join(", ")}</span>
                  <span className="sub">{x.email}{x.phone ? ` · ${x.phone}` : ""}{x.note ? ` · “${x.note}”` : ""}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{x.total}</span>
                <span className={`pill ${STATUS[x.status].tone}`}>{STATUS[x.status].label}</span>
                {x.status === "to_pay" && (
                  <form action={orderStatusAction}><input type="hidden" name="orderId" value={x.id} /><input type="hidden" name="change" value="paid" /><button className="btn ghost sm">Mark paid</button></form>
                )}
                <form action={orderStatusAction}><input type="hidden" name="orderId" value={x.id} /><input type="hidden" name="change" value="handed_over" /><button className="btn secondary sm">Handed over</button></form>
                {x.status === "to_pay" && (
                  <form action={orderStatusAction}><input type="hidden" name="orderId" value={x.id} /><input type="hidden" name="change" value="cancelled" /><button className="btn ghost sm">Cancel</button></form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="ch"><h2>Products</h2></div>
        {products.length === 0 && <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Add your first product: a uniform, sparring kit, gloves or a club hoodie.</p>}
        <div className="lrows" style={{ marginTop: 8 }}>
          {products.map((p) => (
            <div key={p.id} className="lrow" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="grow" style={{ minWidth: 200, opacity: p.active ? 1 : 0.55 }}>
                <b>{p.name}</b> <span className="muted">· £{(p.pricePence / 100).toFixed(2)}</span>
                {!p.active && <span className="pill neutral" style={{ marginLeft: 8 }}>Hidden</span>}
                {(p.options.length > 0 || p.description) && <span className="sub">{[p.options.join(", "), p.description].filter(Boolean).join(" · ")}</span>}
              </span>
              <ProductForm action={saveProductAction.bind(null, p.id)} label="Edit" product={{ name: p.name, description: p.description, price: (p.pricePence / 100).toFixed(2), options: p.options.join(", ") }} />
              <form action={productActiveAction}>
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                <button className="btn ghost sm">{p.active ? "Hide" : "Show"}</button>
              </form>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <ProductForm action={saveProductAction.bind(null, null)} label="Add a product" />
        </div>
      </section>

      {done.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <div className="ch"><h2>Past orders</h2></div>
          <div className="lrows" style={{ marginTop: 8 }}>
            {done.slice(0, 50).map((x) => (
              <div key={x.id} className="lrow" style={{ flexWrap: "wrap", gap: 10 }}>
                <span className="grow" style={{ minWidth: 220 }}><b>{x.name}</b> <span className="muted" style={{ fontSize: 13 }}>· {x.when}</span><span className="sub">{x.items.join(", ")}</span></span>
                <span>{x.total}</span>
                <span className={`pill ${STATUS[x.status].tone}`}>{STATUS[x.status].label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
