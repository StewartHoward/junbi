"use client";

import { useActionState, useState } from "react";
import { joinAction, type JoinState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

type Site = { id: string; name: string };
const MAX = 6;

function SitePicker({ name, sites, value }: { name: string; sites: Site[]; value?: string }) {
  if (sites.length <= 1) return <input type="hidden" name={name} value={sites[0]?.id ?? ""} />;
  return (
    <div>
      <label htmlFor={name}>Which site?</label>
      <select id={name} name={name} defaultValue={value || sites[0].id}>
        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

export function JoinFormView({ token, sites }: { token: string; sites: Site[] }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction.bind(null, token), {});
  const v = state.values ?? {};
  const e = state.errors;
  const [who, setWho] = useState<"children" | "me">(v.who === "me" ? "me" : "children");
  const [count, setCount] = useState(Math.max(1, Number(v.childCount) || 1));

  if (state.done) {
    const n = state.done.names;
    return (
      <div style={{ marginTop: 32 }}>
        <h2 className="m-h2" style={{ fontSize: 32 }}>Thanks, you&apos;re signed up.</h2>
        <p className="m-sub" style={{ fontSize: 19 }}>
          {n.length ? `${n.join(" and ")} ${n.length === 1 ? "is" : "are"} registered with ${state.done.clubName}. ` : ""}
          The club will be in touch about classes. We&apos;ve emailed you a copy.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="m-form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}

      <fieldset>
        <legend>Who&apos;s training?</legend>
        <div className="m-who">
          <label><input type="radio" name="who" value="children" checked={who === "children"} onChange={() => setWho("children")} /> My child or children</label>
          <label><input type="radio" name="who" value="me" checked={who === "me"} onChange={() => setWho("me")} /> Me</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{who === "me" ? "Your details" : "Your details (parent or guardian)"}</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
          <div>
            <label htmlFor="parentFirstName">First name</label>
            <input id="parentFirstName" name="parentFirstName" autoComplete="given-name" defaultValue={v.parentFirstName} {...errProps("parentFirstName", e)} />
            <FieldError id="parentFirstName-err" msg={e?.parentFirstName} />
          </div>
          <div>
            <label htmlFor="parentLastName">Last name</label>
            <input id="parentLastName" name="parentLastName" autoComplete="family-name" defaultValue={v.parentLastName} {...errProps("parentLastName", e)} />
            <FieldError id="parentLastName-err" msg={e?.parentLastName} />
          </div>
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} {...errProps("email", e)} />
          <FieldError id="email-err" msg={e?.email} />
        </div>
        <div>
          <label htmlFor="phone">Mobile</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} {...errProps("phone", e)} />
          <FieldError id="phone-err" msg={e?.phone} />
        </div>
        {who === "me" && (
          <>
            <div>
              <label htmlFor="myDateOfBirth">Date of birth</label>
              <input id="myDateOfBirth" name="myDateOfBirth" type="date" defaultValue={v.myDateOfBirth} {...errProps("myDateOfBirth", e)} />
              <FieldError id="myDateOfBirth-err" msg={e?.myDateOfBirth} />
            </div>
            <SitePicker name="mySiteId" sites={sites} value={v.mySiteId} />
            <div>
              <label htmlFor="myMedical">Anything the instructors should know? (optional)</label>
              <textarea id="myMedical" name="myMedical" defaultValue={v.myMedical} placeholder="Medical conditions, allergies, injuries" />
            </div>
          </>
        )}
      </fieldset>

      {who === "children" && (
        <>
          <input type="hidden" name="childCount" value={count} />
          {Array.from({ length: count }, (_, i) => {
            const k = (f: string) => `children.${i}.${f}`;
            return (
              <fieldset key={i} className="m-person">
                <legend style={{ fontSize: 17 }}>{count > 1 ? `Child ${i + 1}` : "Your child"}</legend>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18 }}>
                  <div>
                    <label htmlFor={`c${i}_firstName`}>First name</label>
                    <input id={`c${i}_firstName`} name={`c${i}_firstName`} defaultValue={v[`c${i}_firstName`]} aria-invalid={e?.[k("firstName")] ? true : undefined} />
                    <FieldError id={`c${i}_firstName-err`} msg={e?.[k("firstName")]} />
                  </div>
                  <div>
                    <label htmlFor={`c${i}_lastName`}>Last name</label>
                    <input id={`c${i}_lastName`} name={`c${i}_lastName`} defaultValue={v[`c${i}_lastName`]} placeholder="If different to yours" />
                  </div>
                </div>
                <div>
                  <label htmlFor={`c${i}_dateOfBirth`}>Date of birth</label>
                  <input id={`c${i}_dateOfBirth`} name={`c${i}_dateOfBirth`} type="date" defaultValue={v[`c${i}_dateOfBirth`]} aria-invalid={e?.[k("dateOfBirth")] ? true : undefined} />
                  <FieldError id={`c${i}_dateOfBirth-err`} msg={e?.[k("dateOfBirth")]} />
                </div>
                <SitePicker name={`c${i}_siteId`} sites={sites} value={v[`c${i}_siteId`]} />
                <div>
                  <label htmlFor={`c${i}_medical`}>Anything the instructors should know? (optional)</label>
                  <textarea id={`c${i}_medical`} name={`c${i}_medical`} defaultValue={v[`c${i}_medical`]} placeholder="Medical conditions, allergies, additional needs" />
                </div>
                {count > 1 && i === count - 1 && (
                  <button type="button" className="m-link" style={{ background: "none", border: 0, padding: 0, alignSelf: "flex-start", cursor: "pointer" }} onClick={() => setCount(count - 1)}>
                    Remove this child
                  </button>
                )}
              </fieldset>
            );
          })}
          <FieldError id="children-err" msg={e?.children} />
          {count < MAX && (
            <button type="button" className="m-btn soft" style={{ alignSelf: "flex-start" }} onClick={() => setCount(count + 1)}>
              Add another child
            </button>
          )}
        </>
      )}

      <fieldset>
        <legend>Permissions</legend>
        <label className="m-check">
          <input type="checkbox" name="firstAidConsent" defaultChecked={v.firstAidConsent === "on"} />
          <span>Instructors can give first aid, and get medical help in an emergency if they can&apos;t reach me.</span>
        </label>
        <label className="m-check">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === "on"} />
          <span>The club can use photos and videos from classes and events. (Optional)</span>
        </label>
        <div>
          <label className="m-check">
            <input type="checkbox" name="terms" defaultChecked={v.terms === "on"} {...errProps("terms", e)} />
            <span>These details are correct, and I&apos;m happy for the club to keep them to run classes and contact me.</span>
          </label>
          <FieldError id="terms-err" msg={e?.terms} />
        </div>
      </fieldset>

      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Signing up…" : "Sign up"}
      </button>
    </form>
  );
}
