"use client";

import { useActionState, useState } from "react";
import { checkoutAction, type CheckoutState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { ARTS, ROLES, SIZES, SYSTEMS, type Ebook } from "@/lib/ebooks";
import { Cover } from "../Cover";

export function CheckoutForm({ books, picked }: { books: Ebook[]; picked: string[] }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  const [items, setItems] = useState<string[]>(Array.isArray(v.items) ? v.items : picked);
  const sv = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const arts = Array.isArray(v.arts) ? v.arts : [];
  const toggle = (slug: string) => setItems((x) => (x.includes(slug) ? x.filter((s) => s !== slug) : [...x, slug]));

  return (
    <form action={action} className="m-form" noValidate style={{ maxWidth: "none" }}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <fieldset className="m-fieldset">
        <legend>Your bag</legend>
        <p className="hint">Untick anything you don&apos;t want. Everything is free.</p>
        <div className="m-bag">
          {books.map((b) => (
            <label key={b.slug} className="m-bag-item">
              <input type="checkbox" name="items" value={b.slug} checked={items.includes(b.slug)} onChange={() => toggle(b.slug)} />
              <Cover book={b} size="xs" />
              <span className="t"><b>{b.title}</b><span>{b.ready ? `PDF, ${b.pages} pages` : "Pre-order: emailed when it's out"}</span></span>
              <span style={{ fontWeight: 600 }}>£0</span>
            </label>
          ))}
        </div>
        <FieldError id="items-err" msg={e?.items} />
        <div className="m-total" style={{ marginTop: 16 }}><span>{items.length} {items.length === 1 ? "ebook" : "ebooks"}</span><span><b>Total £0.00</b></span></div>
      </fieldset>

      <fieldset className="m-fieldset" style={{ marginTop: 24 }}>
        <legend>Your details</legend>
        <p className="hint">So we know where to send them. No card needed.</p>
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" autoComplete="name" defaultValue={sv("name")} required {...errProps("name", e)} />
            <FieldError id="name-err" msg={e?.name} />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={sv("email")} required {...errProps("email", e)} />
            <FieldError id="email-err" msg={e?.email} />
          </div>
          <div>
            <label htmlFor="role">Which best describes you?</label>
            <select id="role" name="role" defaultValue={sv("role")} required {...errProps("role", e)}>
              <option value="" disabled>Choose one</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <FieldError id="role-err" msg={e?.role} />
          </div>
          <div>
            <label htmlFor="clubName">Club name</label>
            <input id="clubName" name="clubName" autoComplete="organization" defaultValue={sv("clubName")} {...errProps("clubName", e)} aria-describedby={e?.clubName ? "clubName-err" : "clubName-hint"} />
            {e?.clubName ? <FieldError id="clubName-err" msg={e.clubName} /> : <p id="clubName-hint" className="hint">Leave blank if you haven&apos;t opened yet.</p>}
          </div>
          <fieldset className="m-fieldset">
            <legend style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>What do you teach?</legend>
            <div className="m-chips">
              {ARTS.map((a) => <label key={a}><input type="checkbox" name="arts" value={a} defaultChecked={arts.includes(a)} />{a}</label>)}
            </div>
          </fieldset>
          <div>
            <label htmlFor="size">How many students?</label>
            <select id="size" name="size" defaultValue={sv("size")} required {...errProps("size", e)}>
              <option value="" disabled>Choose one</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <FieldError id="size-err" msg={e?.size} />
          </div>
          <div>
            <label htmlFor="system">What do you use to run the club now?</label>
            <select id="system" name="system" defaultValue={sv("system")} required {...errProps("system", e)}>
              <option value="" disabled>Choose one</option>
              {SYSTEMS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <FieldError id="system-err" msg={e?.system} />
          </div>
          <label className="m-check">
            <input type="checkbox" name="marketingOk" defaultChecked={sv("marketingOk") === "on"} style={{ width: 22, height: 22, flex: "none", marginTop: 2 }} />
            <span>Send me a few tips for running my club, and the odd email about Junbi. Unsubscribe any time.</span>
          </label>
        </div>
      </fieldset>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      <button type="submit" className="m-btn primary" disabled={pending || items.length === 0} style={{ width: "100%", marginTop: 28 }}>
        {pending ? "Placing your order…" : `Place order · £0.00`}
      </button>
      <p className="m-fine" style={{ marginTop: 12, textAlign: "center" }}>We use your details to send your order and, if you tick the box, the odd email. See our <a href="/privacy" className="m-link">privacy policy</a>.</p>
    </form>
  );
}
