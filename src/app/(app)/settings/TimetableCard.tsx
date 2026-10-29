"use client";

import { useEffect, useMemo, useState } from "react";

type Colours = { accent: string; card: string; text: string; bg: string };
const PRESETS: Record<"light" | "dark", Colours> = {
  light: { accent: "#0066cc", card: "#ffffff", text: "#1d1d1f", bg: "#f5f5f7" },
  dark: { accent: "#2997ff", card: "#1c1c1e", text: "#f5f5f7", bg: "#000000" },
};
/** Defined outside the card so the colour box isn't rebuilt (and its picker closed) on every change. */
function Picker({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, fontSize: 14 }}>
      {label}
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ width: 44, height: 44, padding: 2, flex: "none" }} />
        <span className="num muted" style={{ fontSize: 13 }}>{value.toUpperCase()}</span>
      </span>
    </label>
  );
}
const clean = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? h.slice(1).toLowerCase() : "");

/**
 * Settings: the live timetable for the club's own website. Change the colours and options, see it
 * straight away in the preview, and the code to copy updates to match.
 */
export function TimetableCard({ token, base }: { token: string; base: string }) {
  const [c, setC] = useState<Colours>(PRESETS.light);
  const [ownBg, setOwnBg] = useState(true);
  const [signup, setSignup] = useState(true);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof Colours) => (v: string) => setC((x) => ({ ...x, [k]: v }));

  const params = useMemo(() => {
    const p: Record<string, string> = { accent: clean(c.accent), card: clean(c.card), text: clean(c.text) };
    if (!ownBg) p.bg = clean(c.bg);
    if (signup) p.signup = "1";
    return p;
  }, [c, ownBg, signup]);

  const code = useMemo(() => {
    const attrs = Object.entries(params).map(([k, v]) => `data-${k}="${v}"`).join(" ");
    return `<div class="junbi-timetable" data-token="${token}" ${attrs}></div>\n<script src="${base}/embed.js" async></script>`;
  }, [params, token, base]);

  // Wait until they stop dragging a colour before reloading the preview.
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setPreview(`${base}/embed/timetable/${token}?${new URLSearchParams({ ...params, frame: "jt-preview" }).toString()}`), 250);
    return () => clearTimeout(t);
  }, [params, token, base]);
  // The preview tells us its height, like it does on a club's website, so it fits with no gap.
  const [height, setHeight] = useState(460);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== new URL(base).origin || e.data?.junbiTimetable !== "jt-preview") return;
      const h = Number(e.data.height);
      if (h > 0 && h < 5000) setHeight(Math.ceil(h));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [base]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card" id="timetable" style={{ marginTop: 20 }}>
      <h2 className="section-title">Timetable for your website</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        Show your classes on your own website. It&apos;s live from Junbi, so when you add, move or remove a class, your website updates by itself.
      </p>

      <div className="form" style={{ maxWidth: "none", marginTop: 16 }}>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, alignSelf: "center" }}>Start from</span>
          <button type="button" className="btn secondary sm" onClick={() => setC(PRESETS.light)}>Light</button>
          <button type="button" className="btn secondary sm" onClick={() => setC(PRESETS.dark)}>Dark</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
          <Picker value={c.accent} label="Buttons and highlights" onChange={set("accent")} />
          <Picker value={c.card} label="Boxes" onChange={set("card")} />
          <Picker value={c.text} label="Text" onChange={set("text")} />
          {!ownBg && <Picker value={c.bg} label="Background" onChange={set("bg")} />}
        </div>
        <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={ownBg} onChange={(e) => setOwnBg(e.target.checked)} /> Use my website&apos;s background
        </label>
        <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={signup} onChange={(e) => setSignup(e.target.checked)} /> Show a Sign up button (opens your family sign-up form)
        </label>

        <div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Preview</p>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 12, background: ownBg ? "repeating-conic-gradient(var(--surface-alt) 0% 25%, var(--surface) 0% 50%) 50% / 20px 20px" : c.bg, overflow: "hidden" }}>
            {preview && <iframe key="preview" src={preview} title="Timetable preview" style={{ width: "100%", height, border: 0, display: "block" }} />}
          </div>
          {ownBg && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>The squares show where your website&apos;s own background will be.</p>}
        </div>

        <div>
          <label htmlFor="tt-code">Your code</label>
          <textarea id="tt-code" readOnly value={code} rows={5} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }} />
        </div>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy code"}</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Paste it into an &quot;Embed code&quot; or &quot;Custom HTML&quot; block on Wix, Squarespace, WordPress or most other website builders. If you change the colours later, copy the code again and replace the old one. It only shows class names, days, times and sites.
        </p>
      </div>
    </section>
  );
}
