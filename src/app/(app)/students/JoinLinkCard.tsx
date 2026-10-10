"use client";

import { useActionState, useState } from "react";
import { sendJoinLinkAction } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

/** The club's family sign-up link: copy it to share anywhere, or email it to a parent. */
export function JoinLinkCard({ url, emailOn }: { url: string; emailOn: boolean }) {
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(sendJoinLinkAction, {});
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "Sign up", url }).catch(() => {});
    else copy();
  };
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h2 className="section-title">Family sign-up link</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        Send this to new families. They fill in their own details and their children&apos;s, and they appear here as Trial.
      </p>
      <div className="actions form" style={{ marginTop: 12, flexWrap: "wrap", flexDirection: "row", maxWidth: "none", gap: 10 }}>
        <input readOnly value={url} aria-label="Sign-up link" onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 280px", minWidth: 0 }} />
        <button type="button" className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        <button type="button" className="btn secondary" onClick={share}>Share</button>
      </div>
      <form action={action} className="actions form" style={{ marginTop: 12, flexWrap: "wrap", alignItems: "flex-start", flexDirection: "row", maxWidth: "none", gap: 10 }} noValidate key={state.sent ?? "form"}>
        <div style={{ flex: "1 1 280px" }}>
          <label htmlFor="join-email">Or email it to a parent</label>
          <input id="join-email" name="email" type="email" autoComplete="off" placeholder="parent@example.com" defaultValue={state.values?.email} {...errProps("email", state.errors)} />
          <FieldError id="email-err" msg={state.errors?.email} />
        </div>
        <button className="btn secondary" disabled={pending} style={{ marginTop: 26 }}>{pending ? "Sending…" : "Send"}</button>
      </form>
      {state.sent && <p role="status" className="muted" style={{ fontSize: 14, marginTop: 8 }}>Sent to {state.sent}.{emailOn ? "" : " (Email isn't switched on yet, so it won't arrive until it is.)"}</p>}
    </section>
  );
}
