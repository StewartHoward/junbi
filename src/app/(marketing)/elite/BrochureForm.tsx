"use client";

import { useActionState } from "react";
import { brochureAction, type BrochureState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

/** Name and email in, the Elite brochure out. Also emailed, and logged as a lead in the CRM. */
export function BrochureForm() {
  const [state, action, pending] = useActionState<BrochureState, FormData>(brochureAction, {});
  const e = state.errors;
  const v = state.values ?? {};

  if (state.ok && state.url) {
    return (
      <div className="m-card" role="status" style={{ padding: 32, textAlign: "center", maxWidth: 560, margin: "40px auto 0" }}>
        <p style={{ fontSize: 40, margin: 0, color: "var(--m-success)" }} aria-hidden="true">✓</p>
        <h3 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "8px 0 0" }}>Your brochure is ready.</h3>
        <p className="m-sub" style={{ fontSize: 17, margin: "12px auto 0" }}>We&apos;ve emailed you a copy too.</p>
        <a href={state.url} download className="m-btn primary" style={{ marginTop: 24, width: "auto" }}>Download the brochure (PDF)</a>
      </div>
    );
  }

  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="b-name">Your name</label>
        <input id="b-name" name="name" autoComplete="name" defaultValue={v.name ?? ""} required {...errProps("name", e)} />
        <FieldError id="name-err" msg={e?.name} />
      </div>
      <div>
        <label htmlFor="b-email">Email</label>
        <input id="b-email" name="email" type="email" autoComplete="email" defaultValue={v.email ?? ""} required {...errProps("email", e)} />
        <FieldError id="email-err" msg={e?.email} />
      </div>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, fontWeight: 400, cursor: "pointer" }}>
        <input type="checkbox" name="marketingOk" defaultChecked={v.marketingOk === "on"} style={{ width: 22, height: 22, minHeight: 0, flex: "none", marginTop: 2 }} />
        <span>Send me occasional emails about Junbi. You can unsubscribe at any time.</span>
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      <button type="submit" className="m-btn primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Getting your brochure…" : "Get the brochure"}
      </button>
      <p className="m-fine" style={{ marginTop: 0, textAlign: "center" }}>Free PDF, 6 pages. We use your details to send it and to follow up about Elite. See our <a href="/privacy" className="m-link">privacy policy</a>.</p>
    </form>
  );
}
