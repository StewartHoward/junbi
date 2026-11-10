"use client";

import { useActionState } from "react";
import { eliteAction, type EliteState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";
import { ARTS, SIZES, SYSTEMS } from "@/lib/ebooks";

const SITE_COUNTS = ["One", "Two", "Three or more", "Opening a new one"];

export function EnquiryForm() {
  const [state, action, pending] = useActionState<EliteState, FormData>(eliteAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  const sv = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const arts = Array.isArray(v.arts) ? v.arts : [];

  if (state.ok) {
    return (
      <div className="m-card" role="status" style={{ padding: 32, textAlign: "center", maxWidth: 560, margin: "40px auto 0" }}>
        <p style={{ fontSize: 40, margin: 0, color: "var(--m-success)" }} aria-hidden="true">✓</p>
        <h3 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "8px 0 0" }}>Thanks, we&apos;ve got your enquiry.</h3>
        <p className="m-sub" style={{ fontSize: 17, margin: "12px auto 0" }}>We&apos;ll be in touch within one working day to book a short call. We&apos;ve sent a copy to your email.</p>
      </div>
    );
  }

  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" defaultValue={sv("name")} required {...errProps("name", e)} />
        <FieldError id="name-err" msg={e?.name} />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={sv("email")} required {...errProps("email", e)} />
        <FieldError id="email-err" msg={e?.email} />
      </div>
      <div>
        <label htmlFor="phone">Phone <span className="m-dash">(optional)</span></label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={sv("phone")} {...errProps("phone", e)} />
        <FieldError id="phone-err" msg={e?.phone} />
      </div>
      <div>
        <label htmlFor="clubName">Club name</label>
        <input id="clubName" name="clubName" autoComplete="organization" defaultValue={sv("clubName")} required {...errProps("clubName", e)} />
        <FieldError id="clubName-err" msg={e?.clubName} />
      </div>
      <div>
        <label htmlFor="currentSite">Your website now <span className="m-dash">(optional)</span></label>
        <input id="currentSite" name="currentSite" inputMode="url" autoComplete="url" placeholder="yourclub.co.uk" defaultValue={sv("currentSite")} />
      </div>
      <fieldset className="m-fieldset">
        <legend style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>What do you teach?</legend>
        <div className="m-chips">
          {ARTS.map((a) => <label key={a}><input type="checkbox" name="arts" value={a} defaultChecked={arts.includes(a)} />{a}</label>)}
        </div>
      </fieldset>
      <div>
        <label htmlFor="size">How many students?</label>
        <select id="size" name="size" defaultValue={sv("size")} required {...errProps("size", e)}>
          <option value="" disabled>Choose one</option>
          {SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <FieldError id="size-err" msg={e?.size} />
      </div>
      <div>
        <label htmlFor="sites">How many locations?</label>
        <select id="sites" name="sites" defaultValue={sv("sites")} required {...errProps("sites", e)}>
          <option value="" disabled>Choose one</option>
          {SITE_COUNTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <FieldError id="sites-err" msg={e?.sites} />
      </div>
      <div>
        <label htmlFor="system">What do you use to run the club now?</label>
        <select id="system" name="system" defaultValue={sv("system")} required {...errProps("system", e)}>
          <option value="" disabled>Choose one</option>
          {SYSTEMS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <FieldError id="system-err" msg={e?.system} />
      </div>
      <div>
        <label htmlFor="message">Anything we should know? <span className="m-dash">(optional)</span></label>
        <textarea id="message" name="message" rows={4} defaultValue={sv("message")} placeholder="What you'd like the new system to do, when you'd like to launch" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      <button type="submit" className="m-btn primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Sending…" : "Send enquiry"}
      </button>
      <p className="m-fine" style={{ marginTop: 0, textAlign: "center" }}>No obligation. We use your details to reply to you. See our <a href="/privacy" className="m-link">privacy policy</a>.</p>
    </form>
  );
}
