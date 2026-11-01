"use client";

import { useActionState, useState } from "react";
import { orderAction, type OrderState } from "./actions";
import type { ShopPage } from "@/data/shop";
import { FieldError, errProps } from "@/components/FormBits";

const money = (p: number) => `£${(p / 100).toFixed(2)}`;

/** Pick what you want (and the size), then your details, then pay. */
export function ShopForm({ slug, page }: { slug: string; page: ShopPage }) {
  const [state, action, pending] = useActionState<OrderState, FormData>(orderAction.bind(null, slug), {});
  const v = state.values ?? {};
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(page.products.map((p) => [p.id, Number(v[`q_${p.id}`]) || 0])));
  const total = page.products.reduce((n, p) => n + p.pricePence * (qty[p.id] ?? 0), 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const e = state.errors;

  if (state.done) {
    return (
      <div style={{ marginTop: 28 }}>
        <h2 className="m-h2" style={{ fontSize: 30 }}>Thanks, that&apos;s ordered.</h2>
        <p className="m-sub" style={{ fontSize: 18 }}>Please pay at the club. We&apos;ve emailed you a copy of your order.</p>
      </div>
    );
  }
  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      {page.products.map((p) => (
        <div key={p.id} className="m-person" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <span><b style={{ fontSize: 18 }}>{p.name}</b>{p.description && <span style={{ display: "block", opacity: 0.75, fontSize: 15, marginTop: 2 }}>{p.description}</span>}</span>
            <b style={{ whiteSpace: "nowrap" }}>{money(p.pricePence)}</b>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {p.options.length > 0 && (
              <div style={{ flex: "1 1 160px" }}>
                <label htmlFor={`o_${p.id}`}>Size</label>
                <select id={`o_${p.id}`} name={`o_${p.id}`} defaultValue={v[`o_${p.id}`] ?? ""}>
                  <option value="" disabled>Choose</option>
                  {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="m-btn soft" aria-label={`One fewer ${p.name}`} style={{ minWidth: 44, padding: 0 }} onClick={() => setQty((q) => ({ ...q, [p.id]: Math.max(0, (q[p.id] ?? 0) - 1) }))}>−</button>
              <input name={`q_${p.id}`} value={qty[p.id] ?? 0} readOnly aria-label={`How many ${p.name}`} style={{ width: 56, textAlign: "center" }} />
              <button type="button" className="m-btn soft" aria-label={`One more ${p.name}`} style={{ minWidth: 44, padding: 0 }} onClick={() => setQty((q) => ({ ...q, [p.id]: Math.min(50, (q[p.id] ?? 0) + 1) }))}>+</button>
            </div>
          </div>
        </div>
      ))}

      {count > 0 && (
        <fieldset>
          <legend>Your details</legend>
          <div>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" autoComplete="name" defaultValue={v.name} {...errProps("name", e)} />
            <FieldError id="name-err" msg={e?.name} />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} {...errProps("email", e)} />
            <FieldError id="email-err" msg={e?.email} />
          </div>
          <div>
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
          </div>
          <div>
            <label htmlFor="note">Anything else? (optional)</label>
            <input id="note" name="note" placeholder="e.g. who it's for, or which class to bring it to" defaultValue={v.note} />
          </div>
        </fieldset>
      )}
      <div className="hp" aria-hidden="true"><label htmlFor="website">Leave this empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <p className="m-fine" style={{ margin: 0 }}>
        {count ? `${count} ${count === 1 ? "item" : "items"}, ${money(total)}. ` : "Choose what you'd like. "}
        {count ? (page.card ? "You'll pay by card on the next page, through the club's secure Stripe checkout." : "You'll pay at the club.") : ""}
      </p>
      <button type="submit" className="m-btn primary" disabled={pending || count === 0} style={{ alignSelf: "flex-start" }}>
        {pending ? "One moment…" : count === 0 ? "Order" : page.card ? `Pay ${money(total)}` : "Place order"}
      </button>
    </form>
  );
}
