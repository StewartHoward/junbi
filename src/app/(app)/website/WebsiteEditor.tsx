"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Section, SectionType } from "@/data/website";
import { saveSectionsAction, uploadImageAction } from "./actions";

type TypeInfo = { type: SectionType; label: string; hint: string };

const TONES: Array<{ id: Section["tone"]; label: string }> = [
  { id: "light", label: "White" },
  { id: "grey", label: "Grey" },
  { id: "dark", label: "Black" },
  { id: "colour", label: "Club colour" },
];

/** Shrinks a photo in the browser before upload: long side 1800px, JPEG. Keeps uploads quick on phones. */
async function shrink(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("That file isn't a photo we can use."));
      i.src = url;
    });
    const scale = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * scale);
    const h = Math.round(im.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(im, 0, 0, w, h);
    let q = 0.85;
    let dataUrl = c.toDataURL("image/jpeg", q);
    while (dataUrl.length > 2_400_000 && q > 0.4) dataUrl = c.toDataURL("image/jpeg", (q -= 0.1));
    return { dataUrl, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoButton({ label, multiple, onUploaded }: { label: string; multiple?: boolean; onUploaded: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple={multiple}
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])].slice(0, 12);
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          setErr(null);
          for (const f of files) {
            try {
              const s = await shrink(f);
              const r = await uploadImageAction(s.dataUrl, s.width, s.height);
              if (r.ok) onUploaded(r.id);
              else setErr(r.error);
            } catch (x) {
              setErr(x instanceof Error ? x.message : "Couldn't upload that photo.");
            }
          }
          setBusy(false);
        }}
      />
      <button type="button" className="btn secondary sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : label}</button>
      {err && <span className="error" role="alert" style={{ fontSize: 13 }}>{err}</span>}
    </span>
  );
}

function Photo({ id, onRemove }: { id: string; onRemove: () => void }) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/img/${id}`} alt="" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 10, display: "block", border: "1px solid var(--line)" }} />
      <button type="button" onClick={onRemove} aria-label="Remove photo" style={{ position: "absolute", top: -8, right: -8, width: 26, height: 26, borderRadius: 13, border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer", lineHeight: 1 }}>×</button>
    </span>
  );
}

const field = { display: "flex", flexDirection: "column" as const, gap: 6, marginTop: 12 };

/** The fields for one section. */
function SectionFields({ s, set }: { s: Section; set: (next: Section) => void }) {
  const up = (patch: Partial<Section>) => set({ ...s, ...patch } as Section);
  const live = s.type === "timetable" || s.type === "prices" || s.type === "findUs";
  return (
    <div>
      <div style={field}>
        <label htmlFor={`h-${s.id}`}>Heading</label>
        <input id={`h-${s.id}`} value={s.heading} maxLength={120} onChange={(e) => up({ heading: e.target.value })} />
      </div>
      {"text" in s && (
        <div style={field}>
          <label htmlFor={`t-${s.id}`}>{s.type === "hero" ? "A line about your club" : "Text"}</label>
          <textarea id={`t-${s.id}`} rows={s.type === "text" || s.type === "imageText" ? 5 : 2} value={s.text} maxLength={s.type === "text" ? 3000 : 2000} onChange={(e) => up({ text: e.target.value } as Partial<Section>)} />
          {(s.type === "text" || s.type === "imageText") && <span className="muted" style={{ fontSize: 12 }}>Leave a blank line between paragraphs.</span>}
        </div>
      )}
      {(s.type === "hero" || s.type === "imageText") && (
        <div style={field}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Photo</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {s.image && <Photo id={s.image} onRemove={() => up({ image: null } as Partial<Section>)} />}
            <PhotoButton label={s.image ? "Change photo" : "Add a photo"} onUploaded={(id) => up({ image: id } as Partial<Section>)} />
          </div>
        </div>
      )}
      {s.type === "imageText" && (
        <div style={field}>
          <label htmlFor={`side-${s.id}`}>Photo on the</label>
          <select id={`side-${s.id}`} value={s.side} onChange={(e) => up({ side: e.target.value as "left" | "right" } as Partial<Section>)}>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>
      )}
      {s.type === "gallery" && (
        <div style={field}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Photos</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {s.images.map((id) => <Photo key={id} id={id} onRemove={() => up({ images: s.images.filter((x) => x !== id) } as Partial<Section>)} />)}
            {s.images.length < 24 && <PhotoButton label="Add photos" multiple onUploaded={(id) => set({ ...s, images: [...(s as Extract<Section, { type: "gallery" }>).images, id].slice(0, 24) } as Section)} />}
          </div>
        </div>
      )}
      {s.type === "quotes" && (
        <div style={field}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Quotes</span>
          {s.items.map((q, i) => (
            <div key={i} style={{ display: "grid", gap: 6, padding: 12, border: "1px solid var(--line-soft)", borderRadius: 12 }}>
              <textarea aria-label={`Quote ${i + 1}`} rows={2} value={q.quote} maxLength={400} placeholder="What they said" onChange={(e) => up({ items: s.items.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)) } as Partial<Section>)} />
              <div style={{ display: "flex", gap: 8 }}>
                <input aria-label={`Who said quote ${i + 1}`} value={q.name} maxLength={80} placeholder="e.g. Sarah, mum of two students" onChange={(e) => up({ items: s.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } as Partial<Section>)} style={{ flex: 1 }} />
                <button type="button" className="btn ghost sm" onClick={() => up({ items: s.items.filter((_, j) => j !== i) } as Partial<Section>)}>Remove</button>
              </div>
            </div>
          ))}
          {s.items.length < 9 && <button type="button" className="btn secondary sm" style={{ alignSelf: "flex-start" }} onClick={() => up({ items: [...s.items, { quote: "", name: "" }] } as Partial<Section>)}>Add a quote</button>}
          <span className="muted" style={{ fontSize: 12 }}>Only use real quotes, with permission.</span>
        </div>
      )}
      {live && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>This fills itself in from Junbi, so it&apos;s always up to date.</p>}
      <div style={field}>
        <label htmlFor={`tone-${s.id}`}>Background</label>
        <select id={`tone-${s.id}`} value={s.tone} onChange={(e) => up({ tone: e.target.value as Section["tone"] })}>
          {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
    </div>
  );
}

/**
 * The website editor: the page's sections down the left (open one to edit it, move it, or take it out, and
 * add new ones at the bottom), a live preview on the right. Changes save as a draft by themselves; Publish
 * puts them live.
 */
export function WebsiteEditor({ initial, types, previewUrl, liveUrl, unpublished, published, newSection }: {
  initial: Section[];
  types: TypeInfo[];
  previewUrl: string;
  liveUrl: string;
  unpublished: boolean;
  published: boolean;
  newSection: Record<SectionType, Section>;
}) {
  const [sections, setSections] = useState<Section[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState(unpublished);
  const [isLive, setIsLive] = useState(published);
  const [frameKey, setFrameKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState<{ s: Section; at: number } | null>(null);
  const first = useRef(true);

  const save = useCallback(async (list: Section[], publish: boolean) => {
    setState("saving");
    const r = await saveSectionsAction(JSON.stringify(list), publish);
    if (r.ok) {
      setState("saved");
      setError(null);
      setFrameKey((k) => k + 1);
      if (publish) {
        setChanges(false);
        setIsLive(true);
      }
    } else {
      setState("error");
      setError(r.error ?? "Couldn't save.");
    }
  }, []);

  // Save a draft a moment after each change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setChanges(true);
    setState("saving");
    const t = setTimeout(() => save(sections, false), 800);
    return () => clearTimeout(t);
  }, [sections, save]);

  const update = (i: number, next: Section) => setSections((l) => l.map((x, j) => (j === i ? next : x)));
  const move = (i: number, d: -1 | 1) => setSections((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const remove = (i: number) => {
    setRemoved({ s: sections[i], at: i });
    setSections((l) => l.filter((_, j) => j !== i));
  };
  const undo = () => {
    if (!removed) return;
    setSections((l) => [...l.slice(0, removed.at), removed.s, ...l.slice(removed.at)]);
    setRemoved(null);
  };
  const add = (type: SectionType) => {
    const s = { ...newSection[type], id: Math.random().toString(36).slice(2, 10) } as Section;
    setSections((l) => [...l, s]);
    setOpen(s.id);
    setAdding(false);
  };
  const label = (t: SectionType) => types.find((x) => x.type === t)?.label ?? t;

  return (
    <div className="we">
      <style>{`
        .we-grid { display: grid; grid-template-columns: minmax(320px, 420px) 1fr; gap: 20px; align-items: start; margin-top: 16px; }
        .we-preview { position: sticky; top: 16px; border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface); height: calc(100vh - 140px); min-height: 520px; }
        .we-preview iframe { width: 100%; height: 100%; border: 0; display: block; }
        .we-sec { border: 1px solid var(--line-soft); border-radius: var(--radius-md); background: var(--surface); margin-top: 10px; }
        .we-sec.open { border-color: var(--action); box-shadow: 0 0 0 1px var(--action); }
        .we-head { display: flex; align-items: center; gap: 6px; padding: 10px 10px 10px 14px; }
        .we-head button.grow { flex: 1; text-align: left; background: none; border: 0; padding: 4px 0; cursor: pointer; color: var(--ink); font: inherit; min-height: 36px; }
        .we-icon { width: 36px; height: 36px; border-radius: 18px; border: 0; background: none; cursor: pointer; color: var(--ink-muted); font-size: 16px; }
        .we-icon:hover:not(:disabled) { background: var(--surface-alt); color: var(--ink); }
        .we-icon:disabled { opacity: .3; cursor: default; }
        .we-body { padding: 0 14px 16px; }
        @media (max-width: 1000px) { .we-grid { grid-template-columns: 1fr; } .we-preview { position: static; height: 640px; } }
      `}</style>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
        <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isLive ? <span className="pill ok">✓ Live</span> : <span className="pill neutral">Not published</span>}
          <span className="muted" style={{ fontSize: 14 }} role="status">
            {state === "saving" ? "Saving…" : state === "error" ? error : changes ? "Draft saved. Publish to put your changes live." : isLive ? "Everything's live." : "Draft saved."}
          </span>
        </span>
        <span className="actions" style={{ flexWrap: "wrap" }}>
          <a className="btn ghost" href={previewUrl} target="_blank" rel="noopener">Preview</a>
          {isLive && <a className="btn ghost" href={liveUrl} target="_blank" rel="noopener">View live site</a>}
          <button type="button" className="btn primary" disabled={state === "saving" || (!changes && isLive)} onClick={() => save(sections, true)}>{isLive ? "Publish changes" : "Publish website"}</button>
        </span>
      </div>

      <div className="we-grid">
        <div>
          {removed && (
            <p className="banner" role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>Removed “{removed.s.heading || label(removed.s.type)}”.</span>
              <button type="button" className="btn ghost sm" onClick={undo}>Undo</button>
            </p>
          )}
          {sections.map((s, i) => (
            <div key={s.id} className={`we-sec${open === s.id ? " open" : ""}`}>
              <div className="we-head">
                <button type="button" className="grow" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "block" }}>{label(s.type)}</span>
                  <b style={{ fontSize: 15 }}>{s.heading || label(s.type)}</b>
                </button>
                <button type="button" className="we-icon" aria-label={`Move ${s.heading || label(s.type)} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="we-icon" aria-label={`Move ${s.heading || label(s.type)} down`} disabled={i === sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="we-icon" aria-label={`Remove ${s.heading || label(s.type)}`} onClick={() => remove(i)}>✕</button>
              </div>
              {open === s.id && <div className="we-body form" style={{ maxWidth: "none", gap: 0 }}><SectionFields s={s} set={(n) => update(i, n)} /></div>}
            </div>
          ))}

          <div style={{ marginTop: 14 }}>
            {!adding ? (
              <button type="button" className="btn secondary" onClick={() => setAdding(true)}>+ Add a section</button>
            ) : (
              <div className="card" style={{ padding: 12 }}>
                <div className="lrows">
                  {types.map((t) => (
                    <button key={t.type} type="button" className="lrow" onClick={() => add(t.type)} style={{ width: "100%", textAlign: "left", background: "none", border: 0, borderBottom: "1px solid var(--line-soft)", cursor: "pointer", font: "inherit", color: "inherit" }}>
                      <span className="grow"><b>{t.label}</b><span className="sub">{t.hint}</span></span>
                      <span aria-hidden="true">+</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAdding(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        <div className="we-preview" aria-label="Preview">
          <iframe key={frameKey} src={previewUrl} title="Preview of your website" />
        </div>
      </div>
    </div>
  );
}
