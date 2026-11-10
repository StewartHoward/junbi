"use client";

import { useActionState } from "react";
import { interestAction, type InterestState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

const OPTIONS = [
  { value: "host", label: "Hosting competitions" },
  { value: "enter", label: "Entering my club" },
  { value: "both", label: "Both" },
];

/** "Tell me when it's live" for Junbi Competitions. Logged as a lead in the CRM. */
export function InterestForm() {
  const [state, action, pending] = useActionState<InterestState, FormData>(interestAction, {});
  const e = state.errors;
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="m-card" role="status" style={{ padding: 32, textAlign: "center", maxWidth: 560, margin: "40px auto 0" }}>
        <p style={{ fontSize: 40, margin: 0, color: "var(--m-success)" }} aria-hidden="true">✓</p>
        <h3 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "8px 0 0" }}>You&apos;re on the list.</h3>
        <p className="m-sub" style={{ fontSize: 17, margin: "12px auto 0" }}>We&apos;ll email you as soon as Junbi Competitions opens.</p>
      </div>
    );
  }

  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="c-name">Your name</label>
        <input id="c-name" name="name" autoComplete="name" defaultValue={v.name ?? ""} required {...errProps("name", e)} />
        <FieldError id="name-err" msg={e?.name} />
      </div>
      <div>
        <label htmlFor="c-email">Email</label>
        <input id="c-email" name="email" type="email" autoComplete="email" defaultValue={v.email ?? ""} required {...errProps("email", e)} />
        <FieldError id="email-err" msg={e?.email} />
      </div>
      <div>
        <label htmlFor="c-club">Club or team <span style={{ color: "var(--m-muted)", fontWeight: 400 }}>(optional)</span></label>
        <input id="c-club" name="clubName" autoComplete="organization" defaultValue={v.clubName ?? ""} />
      </div>
      <div>
        <label htmlFor="c-interest">How would you use it?</label>
        <select id="c-interest" name="interest" defaultValue={v.interest ?? "host"} {...errProps("interest", e)}>
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <FieldError id="interest-err" msg={e?.interest} />
      </div>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, fontWeight: 400, cursor: "pointer" }}>
        <input type="checkbox" name="marketingOk" defaultChecked={v.marketingOk === "on"} style={{ width: 22, height: 22, minHeight: 0, flex: "none", marginTop: 2 }} />
        <span>Send me occasional emails about Junbi too. You can unsubscribe at any time.</span>
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      <button type="submit" className="m-btn primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Adding you…" : "Tell me when it's live"}
      </button>
      <p className="m-fine" style={{ marginTop: 0, textAlign: "center" }}>We use your details to tell you when Competitions opens. See our <a href="/privacy" className="m-link">privacy policy</a>.</p>
    </form>
  );
}
