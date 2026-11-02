"use client";

import { useState, useTransition } from "react";
import { unsubscribeAction } from "../actions";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "bad">("idle");
  const [pending, start] = useTransition();
  if (state === "done") return <p className="m-sub" role="status" style={{ marginTop: 28 }}>Done. You won&apos;t get any more emails from us.</p>;
  return (
    <div style={{ marginTop: 28 }}>
      <button type="button" className="m-btn primary" disabled={pending} onClick={() => start(async () => setState((await unsubscribeAction(token)).done ? "done" : "bad"))}>
        {pending ? "Unsubscribing…" : "Unsubscribe me"}
      </button>
      {state === "bad" && <p className="error" role="alert" style={{ marginTop: 12 }}>That link doesn&apos;t work. Reply to any of our emails and we&apos;ll take you off the list.</p>}
    </div>
  );
}
