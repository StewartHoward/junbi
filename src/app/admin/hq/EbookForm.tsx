"use client";

import { useActionState, useState } from "react";
import { saveEbookAction, type EbookFormState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";
import type { Ebook } from "@/lib/ebooks";

const money = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2));
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** Everything about an ebook that shows in the shop. */
export function EbookForm({ book }: { book: Ebook | null }) {
  const [s, run, pending] = useActionState<EbookFormState, FormData>(saveEbookAction.bind(null, book?.id ?? null), {});
  const e = s.errors;
  const [slug, setSlug] = useState(book?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(book));
  const [price, setPrice] = useState(money(book?.pricePence ?? 0));
  const [bg, setBg] = useState(book?.cover.bg ?? "#1d1d1f");
  const [fg, setFg] = useState(book?.cover.fg ?? "#ffffff");
  const [accent, setAccent] = useState(book?.cover.accent ?? "#c8102e");
  const field = (name: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={name}>{label}</label>
      {input}
      {e?.[name] ? <FieldError id={`${name}-err`} msg={e[name]} /> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
  const grid2: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" };
  return (
    <form action={run} className="form" style={{ maxWidth: "none", display: "grid", gap: 18 }}>
      {e?.form && <p className="bad-t" role="alert">{e.form}</p>}
      <h3 className="section-title" style={{ margin: 0 }}>The basics</h3>
      {field("title", "Title", <input id="title" name="title" defaultValue={book?.title} required {...errProps("title", e)} onChange={(ev) => { if (!slugTouched) setSlug(slugify(ev.target.value)); }} />)}
      {field("slug", "Web address", <input id="slug" name="slug" value={slug} onChange={(ev) => { setSlugTouched(true); setSlug(ev.target.value); }} required {...errProps("slug", e)} />, `junbi.co.uk/library/${slug || "your-ebook"}`)}
      {field("subtitle", "Subtitle", <input id="subtitle" name="subtitle" defaultValue={book?.subtitle} />, "Shown under the title and on the drawn cover.")}
      {field("pitch", "One-line pitch", <input id="pitch" name="pitch" defaultValue={book?.pitch} maxLength={200} />, "Shown on the shop card and in emails.")}
      {field("description", "Description", <textarea id="description" name="description" rows={6} defaultValue={book?.description} />, "For the product page. Leave a blank line between paragraphs.")}

      <h3 className="section-title" style={{ margin: "12px 0 0" }}>Price and status</h3>
      <div style={grid2}>
        {field("price", "Price (£)", <input id="price" name="price" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} {...errProps("price", e)} />, price === "" || Number(price) === 0 ? "0 means free: a £0 checkout with no card." : "Paid by card through Junbi's Stripe.")}
        {field("worth", "Worth (£), optional", <input id="worth" name="worth" inputMode="decimal" defaultValue={money(book?.worthPence)} placeholder="e.g. 19" {...errProps("worth", e)} />, "Shown crossed out next to the price. Leave blank to hide.")}
        {field("status", "Status", (
          <select id="status" name="status" defaultValue={book?.status ?? "draft"} {...errProps("status", e)}>
            <option value="draft">Draft (hidden from the shop)</option>
            <option value="preorder">Pre-orders (on sale, emailed when ready)</option>
            <option value="live">Live (instant download)</option>
          </select>
        ))}
        {field("pages", "Pages", <input id="pages" name="pages" type="number" min={0} max={2000} defaultValue={book?.pages ?? 0} />)}
        {field("sort", "Order in the shop", <input id="sort" name="sort" type="number" min={0} max={999} defaultValue={book?.sort ?? 10} />, "Lower numbers come first.")}
      </div>

      <h3 className="section-title" style={{ margin: "12px 0 0" }}>What&apos;s inside</h3>
      {field("contents", "Contents", <textarea id="contents" name="contents" rows={7} defaultValue={book?.contents.join("\n")} />, "One chapter or point per line.")}
      {field("forWho", "Who it's for", <textarea id="forWho" name="forWho" rows={4} defaultValue={book?.forWho.join("\n")} />, "One per line.")}

      <h3 className="section-title" style={{ margin: "12px 0 0" }}>Follow-up email tip</h3>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Two days after someone orders (if they said yes to emails), we send them one tip from the book.</p>
      {field("tipHeading", "Tip heading", <input id="tipHeading" name="tipHeading" defaultValue={book?.tip.heading} />)}
      {field("tipBody", "Tip", <textarea id="tipBody" name="tipBody" rows={3} defaultValue={book?.tip.body} />)}

      <h3 className="section-title" style={{ margin: "12px 0 0" }}>Drawn cover colours</h3>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Used until you upload a designed cover image.</p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        {[["coverBg", "Background", bg, setBg], ["coverFg", "Text", fg, setFg], ["coverAccent", "Stripe", accent, setAccent]].map(([n, l, v, set]) => (
          <div key={n as string}>
            <label htmlFor={n as string}>{l as string}</label>
            <input id={n as string} name={n as string} type="color" value={v as string} onChange={(ev) => (set as (x: string) => void)(ev.target.value)} style={{ width: 64, height: 44, padding: 2 }} />
          </div>
        ))}
        <div aria-hidden="true" style={{ width: 66, aspectRatio: "3 / 4", borderRadius: "3px 8px 8px 3px", background: bg, color: fg, padding: "8px 6px 6px 10px", fontSize: 9, fontWeight: 700, display: "flex", flexDirection: "column", boxShadow: "0 6px 14px -6px rgba(0,0,0,.4)" }}>
          <span>Preview</span>
          <span style={{ marginTop: "auto", height: 4, background: accent, margin: "auto -6px 6px -10px" }} />
          <span>junbi</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : book ? "Save changes" : "Create ebook"}</button>
        {s.ok && <span className="ok-t" role="status">{s.ok}</span>}
        {e && !e.form && Object.keys(e).length > 0 && <span className="bad-t" role="alert">Check the highlighted fields.</span>}
      </div>
    </form>
  );
}
