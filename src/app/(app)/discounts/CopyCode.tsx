"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost"
      onClick={async () => {
        try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
