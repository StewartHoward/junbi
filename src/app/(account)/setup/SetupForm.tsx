"use client";

import { useActionState } from "react";
import { setupAction, type FormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { DISCIPLINES, TAEKWONDO_PRESETS } from "@/lib/disciplines";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setupAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  return (
    <form action={action} className="m-form m-wide" noValidate style={{ gap: 40 }}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}

      <fieldset className="m-fieldset" {...errProps("disciplines", e)}>
        <legend>Which arts do you teach?</legend>
        <p className="hint">Choose all that apply. Your dashboard is set up around what you pick.</p>
        <div className="m-choices">
          {DISCIPLINES.map((d) =>
            d.available ? (
              <label key={d.id} className="m-choice">
                <input type="checkbox" name="disciplines" value={d.id} defaultChecked={d.id === "taekwondo"} />
                <strong>{d.name}</strong>
                <span>Belts, gradings and syllabus ready to go</span>
              </label>
            ) : (
              <label key={d.id} className="m-choice soon">
                <input type="checkbox" name="interest" value={d.id} />
                <strong>{d.name}</strong>
                <span>Coming soon. Tick to hear first.</span>
              </label>
            ),
          )}
        </div>
        <FieldError id="disciplines-err" msg={e?.disciplines} />
      </fieldset>

      <fieldset className="m-fieldset">
        <legend>Your first site</legend>
        <p className="hint">Where you train. You can add more sites later in Settings.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label htmlFor="siteName">Site name</label>
            <input id="siteName" name="siteName" placeholder="e.g. Southport" defaultValue={v.siteName} required {...errProps("siteName", e)} />
            <FieldError id="siteName-err" msg={e?.siteName} />
          </div>
          <div>
            <label htmlFor="siteAddress">Address (optional)</label>
            <input id="siteAddress" name="siteAddress" autoComplete="street-address" defaultValue={v.siteAddress} />
          </div>
        </div>
      </fieldset>

      <fieldset className="m-fieldset">
        <legend>Taekwondo belt system</legend>
        <p className="hint">We&apos;ll load the grades for you. You can rename or add grades later.</p>
        <div className="m-choices">
          {Object.entries(TAEKWONDO_PRESETS).map(([id, p]) => (
            <label key={id} className="m-choice">
              <input type="radio" name="syllabus" value={id} defaultChecked={id === "wt"} />
              <strong>{p.label}</strong>
              <span>{p.description}</span>
            </label>
          ))}
          <label className="m-choice">
            <input type="radio" name="syllabus" value="none" />
            <strong>My own</strong>
            <span>Start empty and add your own grades.</span>
          </label>
        </div>
      </fieldset>

      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Setting up…" : "Finish set-up"}
      </button>
    </form>
  );
}
