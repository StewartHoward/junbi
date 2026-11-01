"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="actions form" style={{ marginTop: 12, flexWrap: "wrap", flexDirection: "row", maxWidth: "none", gap: 10 }}>
      <input readOnly value={url} aria-label="Shop link" onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 280px", minWidth: 0 }} />
      <button type="button" className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {} }}>{copied ? "Copied" : "Copy link"}</button>
      <a className="btn secondary" href={url} target="_blank" rel="noopener">Open</a>
    </div>
  );
}
