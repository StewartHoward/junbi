"use client";

import { useActionState, useState } from "react";
import { createDiscountAction, type DiscountState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";
import { randomCode } from "@/lib/discounts";

/** Make a code: one anyone can use (with an optional limit), or a one-off code for a single family. */
export function DiscountForm() {
  const [state, action, pending] = useActionState<DiscountState, FormData>(createDiscountAction, {});
  // A fresh form after each code is made; the typed values come back if there was a problem.
  return <Fields key={state.saved ?? JSON.stringify(state.values ?? null)} state={state} action={action} pending={pending} />;
}

function Fields({ state, action, pending }: { state: DiscountState; action: (f: FormData) => void; pending: boolean }) {
  const e = state.errors;
  const v = state.values ?? {};
  const [who, setWho] = useState<"anyone" | "one">(v.who === "one" ? "one" : "anyone");
  const [code, setCode] = useState(v.code ?? "");
  const [note, setNote] = useState(v.note ?? "");

  return (
    <form
      action={action}
      className="form"
      noValidate
      style={{ maxWidth: "none" }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Who can use it?</legend>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 15 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
            <input type="radio" name="who" value="anyone" checked={who === "anyone"} onChange={() => setWho("anyone")} /> Anyone with the code
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
            <input type="radio" name="who" value="one" checked={who === "one"} onChange={() => { setWho("one"); if (!code) setCode(randomCode(note.split(" ")[0])); }} /> One family only
          </label>
        </div>
      </fieldset>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "start" }}>
        <div>
          <label htmlFor="d-note">{who === "one" ? "Who's it for?" : "What's it for? (optional)"}</label>
          <input id="d-note" name="note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={who === "one" ? "e.g. Sarah Jones" : "e.g. Summer offer"} {...errProps("note", e)} />
          <FieldError id="note-err" msg={e?.note} />
        </div>
        <div>
          <label htmlFor="d-code">Code</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="d-code"
              name="code"
              value={code}
              onChange={(ev) => setCode(ev.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder={who === "one" ? "" : "SUMMER20"}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              style={{ textTransform: "uppercase", minWidth: 0 }}
              {...errProps("code", e)}
            />
            <button type="button" className="btn soft sm" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => setCode(randomCode(who === "one" ? note.split(" ")[0] : ""))}>
              Make one
            </button>
          </div>
          <FieldError id="code-err" msg={e?.code} />
        </div>
        <div>
          <label htmlFor="d-percent">Off membership fees (%)</label>
          <input id="d-percent" name="percent" inputMode="numeric" placeholder="20" defaultValue={v.percent} {...errProps("percent", e)} />
          <FieldError id="percent-err" msg={e?.percent} />
        </div>
        {who === "anyone" && (
          <div>
            <label htmlFor="d-max">How many families (optional)</label>
            <input id="d-max" name="maxUses" inputMode="numeric" placeholder="No limit" defaultValue={v.maxUses} {...errProps("maxUses", e)} />
            <FieldError id="maxUses-err" msg={e?.maxUses} />
          </div>
        )}
        <div>
          <label htmlFor="d-expires">Use by (optional)</label>
          <input id="d-expires" name="expiresOn" type="date" defaultValue={v.expiresOn} {...errProps("expiresOn", e)} />
          <FieldError id="expiresOn-err" msg={e?.expiresOn} />
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Making…" : "Make code"}</button>
        {state.saved && <span role="status" className="muted">{state.saved} is ready to share</span>}
      </div>
    </form>
  );
}
