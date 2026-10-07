"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSignup, type SignupState } from "./actions";
import { PLANS } from "@/lib/plans";
import { STUDENT_BANDS } from "@/data/signups";

const initial: SignupState = { status: "idle" };

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="error" role="alert">
      {msg}
    </p>
  ) : null;
}

export function SignupForm({ plan }: { plan?: string }) {
  const [state, action, pending] = useActionState(submitSignup, initial);
  const e = state.errors ?? {};

  if (state.status === "done") {
    return (
      <div className="m-done" role="status">
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>You&apos;re on the list.</h2>
        <p style={{ margin: "12px 0 0", color: "#6e6e73" }}>
          Thanks{state.clubName ? `, ${state.clubName}` : ""}. We&apos;ll be in touch personally to plan your move to Junbi.
        </p>
        <p style={{ margin: "20px 0 0" }}>
          <Link href="/dev/login" className="m-link">
            Explore the demo while you wait
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="m-form" noValidate>
      {e.form && <p className="error" role="alert">{e.form}</p>}

      <div>
        <label htmlFor="clubName">Club name</label>
        <input id="clubName" name="clubName" autoComplete="organization" required aria-invalid={!!e.clubName} aria-describedby={e.clubName ? "clubName-err" : undefined} />
        <Err id="clubName-err" msg={e.clubName} />
      </div>
      <div>
        <label htmlFor="contactName">Your name</label>
        <input id="contactName" name="contactName" autoComplete="name" required aria-invalid={!!e.contactName} aria-describedby={e.contactName ? "contactName-err" : undefined} />
        <Err id="contactName-err" msg={e.contactName} />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!e.email} aria-describedby={e.email ? "email-err" : undefined} />
        <Err id="email-err" msg={e.email} />
      </div>
      <div>
        <label htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        <div style={{ flex: "2 1 220px" }}>
          <label htmlFor="activeStudents">Active students</label>
          <select id="activeStudents" name="activeStudents" defaultValue="" required aria-invalid={!!e.activeStudents} aria-describedby={e.activeStudents ? "students-err" : undefined}>
            <option value="" disabled>Choose</option>
            {STUDENT_BANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <Err id="students-err" msg={e.activeStudents} />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label htmlFor="sites">Sites</label>
          <input id="sites" name="sites" type="number" min={1} max={50} defaultValue={1} inputMode="numeric" />
        </div>
      </div>
      <div>
        <label htmlFor="currentSystem">What do you use now? (optional)</label>
        <input id="currentSystem" name="currentSystem" placeholder="e.g. NEST, Martialytics, spreadsheets" />
      </div>
      <div>
        <label htmlFor="plan">Plan you&apos;re interested in</label>
        <select id="plan" name="plan" defaultValue={PLANS.some((p) => p.id === plan) ? plan : ""}>
          <option value="">Not sure yet</option>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" name="consentToContact" style={{ width: 22, minHeight: 22, height: 22, marginTop: 2, flexShrink: 0 }} aria-invalid={!!e.consentToContact} aria-describedby={e.consentToContact ? "consent-err" : undefined} />
          <span>Junbi can contact me about joining as a Founding Club. We&apos;ll only use your details for this, and you can ask us to delete them at any time.</span>
        </label>
        <Err id="consent-err" msg={e.consentToContact} />
      </div>

      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Claim my place"}
      </button>
    </form>
  );
}
