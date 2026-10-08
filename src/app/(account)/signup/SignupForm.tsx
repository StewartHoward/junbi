"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type FormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { SELF_SERVE_PLANS, formatPounds } from "@/lib/plans";

export function SignupForm({ plan, founding }: { plan: string; founding: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <input type="hidden" name="founding" value={founding ? "1" : "0"} />
      <div>
        <label htmlFor="clubName">Club name</label>
        <input id="clubName" name="clubName" autoComplete="organization" defaultValue={v.clubName} required {...errProps("clubName", e)} />
        <FieldError id="clubName-err" msg={e?.clubName} />
      </div>
      <div>
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" defaultValue={v.name} required {...errProps("name", e)} />
        <FieldError id="name-err" msg={e?.name} />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} required {...errProps("email", e)} />
        <FieldError id="email-err" msg={e?.email} />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required {...errProps("password", e)} aria-describedby={e?.password ? "password-err" : "password-hint"} />
        {e?.password ? <FieldError id="password-err" msg={e.password} /> : <p id="password-hint" className="hint">At least 10 characters. A short phrase is easiest to remember.</p>}
      </div>
      <div>
        <label htmlFor="plan">Plan</label>
        <select id="plan" name="plan" defaultValue={v.plan || plan}>
          {SELF_SERVE_PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatPounds(p.monthlyPence)} a month · {p.limits}
            </option>
          ))}
        </select>
        <p className="hint">{founding ? "Free for 30 days" : "Free for 14 days"}, with every feature. No card needed, and you can change plan any time.</p>
      </div>
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="m-check">
          <input type="checkbox" name="terms" defaultChecked={v.terms === "on"} {...errProps("terms", e)} />
          <span>I agree to Junbi&apos;s terms and privacy policy, and I&apos;m allowed to set this club up.</span>
        </label>
        <FieldError id="terms-err" msg={e?.terms} />
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Creating your club…" : founding ? "Claim my Founding Club place" : "Start free trial"}
      </button>
      <p className="m-auth-alt">
        Already using Junbi? <Link href="/login" className="m-link">Sign in</Link>
      </p>
    </form>
  );
}
