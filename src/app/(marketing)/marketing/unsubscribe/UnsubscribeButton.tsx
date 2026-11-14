"use client";

import { useState, useTransition } from "react";
import { marketingUnsubscribeAction } from "./actions";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "bad">("idle");
  const [pending, start] = useTransition();
  if (state === "done") return <p className="m-sub" role="status" style={{ marginTop: 28 }}>Done. We won&apos;t email your club again.</p>;
  return (
    <div style={{ marginTop: 28 }}>
      <button type="button" className="m-btn primary" disabled={pending} onClick={() => start(async () => setState((await marketingUnsubscribeAction(token)).done ? "done" : "bad"))}>
        {pending ? "Unsubscribing…" : "Unsubscribe me"}
      </button>
      {state === "bad" && <p className="error" role="alert" style={{ marginTop: 12 }}>That link doesn&apos;t work. Reply to our email and we&apos;ll take you off the list.</p>}
    </div>
  );
}
