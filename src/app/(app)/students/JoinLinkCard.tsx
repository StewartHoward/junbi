"use client";

import { useActionState, useState } from "react";
import { sendJoinLinkAction } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

/** The club's family sign-up link: copy it to share anywhere, or email it to a parent. */
export function JoinLinkCard({ url, emailOn, payments }: { url: string; emailOn: boolean; payments: "debit" | "prices" | "none" }) {
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
        Send this to new families. They fill in their own details and their children&apos;s{payments === "debit" ? ", choose a membership and set up their Direct Debit" : payments === "prices" ? " and choose a membership" : ""}, and join as members straight away.
        {payments === "none" && <> Add your <a href="/settings#prices">membership prices</a> so families can pick one.</>}
        {payments === "prices" && <> Connect Stripe or GoCardless on <a href="/payments">Payments</a> to take Direct Debit at the same time.</>}
      </p>
      <div className="actions form" style={{ marginTop: 12, flexWrap: "wrap", flexDirection: "row", maxWidth: "none", gap: 10 }}>
        <input readOnly value={url} aria-label="Sign-up link" onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 280px", minWidth: 0 }} />
        <button type="button" className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        <button type="button" className="btn secondary" onClick={share}>Share</button>
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/join-qr?format=svg" alt="QR code for your sign-up link" width={132} height={132} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }} />
        <div style={{ flex: "1 1 240px" }}>
          <p style={{ fontWeight: 600 }}>QR code</p>
          <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>Parents scan it with their phone camera. Put it on the wall, on a flyer or on screen at the front desk.</p>
          <div className="actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <a className="btn secondary" href="/api/join-qr?format=png&download=1" download>Download QR</a>
            <a className="btn secondary" href="/print/signup-poster" target="_blank" rel="noopener">Print a poster</a>
          </div>
        </div>
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
