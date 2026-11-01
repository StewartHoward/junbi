"use client";

import { useActionState, useState } from "react";
import { FieldError, errProps } from "@/components/FormBits";
import { saveWebsiteAction, type WebsiteState } from "./websiteActions";

type Settings = { tagline?: string; about?: string; phone?: string; email?: string; colour?: string; showPrices?: boolean };

/** Settings: the club's own web page at junbi.co.uk/c/<slug>, built from its Junbi details. */
export function WebsiteCard({ slug, published, settings, base }: { slug: string; published: boolean; settings: Settings; base: string }) {
  const [state, action, pending] = useActionState<WebsiteState, FormData>(saveWebsiteAction, {});
  const v = state.values;
  const e = state.errors;
  const [address, setAddress] = useState(v?.slug ?? slug);
  const [colour, setColour] = useState(v?.colour ?? settings.colour ?? "#0066cc");
  const live = state.saved ? state.saved.published : published;
  const savedSlug = state.saved?.slug ?? slug;
  return (
    <section className="card" id="website" style={{ marginTop: 20 }}>
      <h2 className="section-title">Your club website</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        A ready-made page for your club with your timetable, prices, a free-trial form that goes straight into Leads, your sign-up link, shop and parent login. Use it as your website, or link to it from the one you have.
      </p>
      <p style={{ marginTop: 10, fontSize: 14 }}>
        {live ? <span className="pill ok">✓ Live</span> : <span className="pill neutral">Not published</span>}{" "}
        <a href={`${base}/c/${savedSlug}`} target="_blank" rel="noopener">{live ? "View your page" : "Preview your page"} ›</a>
      </p>
      <form action={action} className="form" noValidate style={{ maxWidth: "none", marginTop: 12 }}>
        {state.saved && <p className="banner" role="status">Saved.{state.saved.published ? " Your page is live." : ""}</p>}
        {e?.form && <p className="error" role="alert">{e.form}</p>}
        <div>
          <label htmlFor="w-slug">Web address</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 15 }}>{base.replace(/^https?:\/\//, "")}/c/</span>
            <input id="w-slug" name="slug" value={address} onChange={(ev) => setAddress(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} style={{ flex: "1 1 200px", minWidth: 0 }} {...errProps("slug", e)} />
          </div>
          <FieldError id="slug-err" msg={e?.slug} />
        </div>
        <div>
          <label htmlFor="w-tagline">Tagline</label>
          <input id="w-tagline" name="tagline" placeholder="e.g. Taekwondo for all ages in Southport and Preston" defaultValue={v?.tagline ?? settings.tagline} />
        </div>
        <div>
          <label htmlFor="w-about">About your club</label>
          <textarea id="w-about" name="about" rows={5} placeholder="Who you are, who your classes are for, what makes your club different." defaultValue={v?.about ?? settings.about} />
        </div>
        <div className="grid2">
          <div>
            <label htmlFor="w-phone">Phone (optional)</label>
            <input id="w-phone" name="phone" type="tel" defaultValue={v?.phone ?? settings.phone} />
          </div>
          <div>
            <label htmlFor="w-email">Email (optional)</label>
            <input id="w-email" name="email" type="email" defaultValue={v?.email ?? settings.email} {...errProps("email", e)} />
            <FieldError id="email-err" msg={e?.email} />
          </div>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", margin: 0 }}>
          Club colour
          <input type="color" name="colour" value={colour} onChange={(ev) => setColour(ev.target.value)} aria-label="Club colour" style={{ width: 44, height: 44, padding: 2 }} />
          <span className="num muted" style={{ fontSize: 13 }}>{colour.toUpperCase()}</span>
        </label>
        <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="showPrices" defaultChecked={v ? v.showPrices === "on" : settings.showPrices !== false} /> Show your membership prices
        </label>
        <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="published" defaultChecked={v ? v.published === "on" : published} /> Publish it, so anyone can see it
        </label>
        <div className="actions">
          <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Your classes, sites and prices come straight from Junbi, so the page is always up to date. Add your sites&apos; addresses under Sites below so families can find you.</p>
      </form>
    </section>
  );
}
