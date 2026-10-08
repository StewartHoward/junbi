"use client";

import { useActionState, useState } from "react";
import { setupAction, type FormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { DISCIPLINES, type Preset } from "@/lib/disciplines";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setupAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  const [chosen, setChosen] = useState<string[]>(v.disciplines ? v.disciplines.split(",") : []);
  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  const chosenArts = DISCIPLINES.filter((d) => chosen.includes(d.id));

  return (
    <form action={action} className="m-form m-wide" noValidate style={{ gap: 40 }}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}

      <fieldset className="m-fieldset" {...errProps("disciplines", e)}>
        <legend>Which arts do you teach?</legend>
        <p className="hint">Choose all that apply. Your dashboard, belts and classes are set up around what you pick.</p>
        <div className="m-choices">
          {DISCIPLINES.map((d) => (
            <label key={d.id} className="m-choice">
              <input type="checkbox" name="disciplines" value={d.id} checked={chosen.includes(d.id)} onChange={(ev) => toggle(d.id, ev.target.checked)} />
              <strong>{d.name}</strong>
              <span>{d.presets.length ? `${(d.presets[0] as Preset).label} ready to go` : "Attendance and payments, no belts"}</span>
            </label>
          ))}
        </div>
        <FieldError id="disciplines-err" msg={e?.disciplines} />
      </fieldset>

      <fieldset className="m-fieldset">
        <legend>Your first site</legend>
        <p className="hint">Where you train. You can add more sites later in Settings.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label htmlFor="siteName">Site name</label>
            <input id="siteName" name="siteName" placeholder="e.g. the town or venue" defaultValue={v.siteName} required {...errProps("siteName", e)} />
            <FieldError id="siteName-err" msg={e?.siteName} />
          </div>
          <div>
            <label htmlFor="siteAddress">Address (optional)</label>
            <input id="siteAddress" name="siteAddress" autoComplete="street-address" defaultValue={v.siteAddress} />
          </div>
        </div>
      </fieldset>

      {chosenArts
        .filter((d) => d.presets.length > 0)
        .map((d) => {
          const presets = d.presets as readonly Preset[];
          return (
            <fieldset key={d.id} className="m-fieldset">
              <legend>{d.name} belts</legend>
              <p className="hint">We&apos;ll load the grades for you. You can rename or add grades later.</p>
              <div className="m-choices">
                {presets.map((p, i) => (
                  <label key={p.id} className="m-choice">
                    <input type="radio" name={`syllabus_${d.id}`} value={p.id} defaultChecked={i === 0} />
                    <strong>{p.label}</strong>
                    <span>{p.description}</span>
                  </label>
                ))}
                <label className="m-choice">
                  <input type="radio" name={`syllabus_${d.id}`} value="none" />
                  <strong>My own</strong>
                  <span>Start empty and add your own grades.</span>
                </label>
              </div>
            </fieldset>
          );
        })}

      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Setting up…" : "Finish set-up"}
      </button>
    </form>
  );
}
