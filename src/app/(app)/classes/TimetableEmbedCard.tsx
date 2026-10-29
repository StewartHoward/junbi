"use client";

import { useState } from "react";

/** The code a club pastes into its own website to show its live timetable. */
export function TimetableEmbedCard({ token, base }: { token: string; base: string }) {
  const [signup, setSignup] = useState(true);
  const [dark, setDark] = useState(false);
  const [accent, setAccent] = useState("#0066cc");
  const [copied, setCopied] = useState(false);
  const colour = /^#[0-9a-f]{6}$/i.test(accent) ? accent.slice(1).toLowerCase() : "";
  const attrs = [`data-token="${token}"`, dark ? `data-theme="dark"` : "", colour && colour !== "0066cc" ? `data-accent="${colour}"` : "", signup ? `data-signup="1"` : ""].filter(Boolean).join(" ");
  const code = `<div class="junbi-timetable" ${attrs}></div>\n<script src="${base}/embed.js" async></script>`;
  const preview = `${base}/embed/timetable/${token}?${new URLSearchParams({ ...(dark ? { theme: "dark" } : {}), ...(colour ? { accent: colour } : {}), ...(signup ? { signup: "1" } : {}) }).toString()}`;
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
    <section className="card" style={{ marginTop: 20 }}>
      <h2 className="section-title">Timetable for your website</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        Paste this code into your website where the timetable should go. It shows your classes live from Junbi, so when you add, move or remove a class here, your website updates by itself.
      </p>
      <div className="form" style={{ maxWidth: "none", marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={signup} onChange={(e) => setSignup(e.target.checked)} /> Show a Sign up button
          </label>
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark background
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}>
            Your colour
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Button and highlight colour" style={{ width: 44, height: 44, padding: 2 }} />
          </label>
        </div>
        <textarea readOnly value={code} aria-label="Timetable code" rows={3} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }} />
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy code"}</button>
          <a className="btn secondary" href={preview} target="_blank" rel="noopener">Preview</a>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Works on Wix, Squarespace, WordPress and most website builders: add an &quot;Embed code&quot; or &quot;Custom HTML&quot; block and paste it in. It only shows class names, days, times and sites.
        </p>
      </div>
    </section>
  );
}
