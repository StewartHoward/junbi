"use client";

import { useActionState, useEffect, useState } from "react";
import { FieldError } from "@/components/FormBits";
import type { ContactState } from "../actions";

type Guardian = { id: string; firstName: string; lastName: string; name: string; relationship: string; isPayer: boolean; email: string | null; phone: string | null };
type Contact = { addressLine1: string | null; addressLine2: string | null; town: string | null; postcode: string | null; emergencyName: string | null; emergencyPhone: string | null };

const REL: Record<string, string> = { parent: "Parent", guardian: "Guardian", self: "Self", other: "Contact" };
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

/** Parents' phone and email, home address and emergency contact, with an inline edit form. */
export function ContactCard({ guardians, contact, action, canEdit }: { guardians: Guardian[]; contact: Contact | null; action: (s: ContactState, f: FormData) => Promise<ContactState>; canEdit: boolean }) {
  const [state, run, pending] = useActionState<ContactState, FormData>(action, {});
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (state.saved) setEditing(false); }, [state]);
  const e = state.errors;
  // After an error, show what they typed rather than the saved details.
  const dv = (name: string, saved: string) => (state.values && !state.saved ? state.values[name] ?? "" : saved);
  const address = contact ? [contact.addressLine1, contact.addressLine2, contact.town, contact.postcode].filter(Boolean) : [];

  if (editing && contact) {
    return (
      <form key={JSON.stringify(state.values ?? null)} action={run} className="form" noValidate style={{ maxWidth: "none", marginTop: 10 }}>
        {guardians.map((g) => (
          <fieldset key={g.id} style={{ border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <legend className="muted" style={{ fontSize: 13, padding: "0 4px" }}>{REL[g.relationship] ?? "Contact"}</legend>
            <input type="hidden" name="guardianId" value={g.id} />
            <div className="row" style={{ gap: 8 }}>
              <div style={{ flex: "1 1 120px" }}><label htmlFor={`gf-${g.id}`}>First name</label><input id={`gf-${g.id}`} name={`g_${g.id}_firstName`} defaultValue={dv(`g_${g.id}_firstName`, g.firstName)} /></div>
              <div style={{ flex: "1 1 120px" }}><label htmlFor={`gl-${g.id}`}>Last name</label><input id={`gl-${g.id}`} name={`g_${g.id}_lastName`} defaultValue={dv(`g_${g.id}_lastName`, g.lastName)} /></div>
            </div>
            <div style={{ marginTop: 8 }}><label htmlFor={`ge-${g.id}`}>Email</label><input id={`ge-${g.id}`} type="email" name={`g_${g.id}_email`} defaultValue={dv(`g_${g.id}_email`, g.email ?? "")} /></div>
            <div style={{ marginTop: 8 }}><label htmlFor={`gp-${g.id}`}>Phone</label><input id={`gp-${g.id}`} type="tel" name={`g_${g.id}_phone`} defaultValue={dv(`g_${g.id}_phone`, g.phone ?? "")} /></div>
          </fieldset>
        ))}
        {Object.entries(e ?? {}).filter(([k]) => k.startsWith("guardians.")).map(([k, v]) => <FieldError key={k} id={k} msg={v} />)}
        <div><label htmlFor="a1">Address</label><input id="a1" name="addressLine1" defaultValue={dv("addressLine1", contact.addressLine1 ?? "")} placeholder="House number and street" /></div>
        <div><label htmlFor="a2" className="sr-only">Address line 2</label><input id="a2" name="addressLine2" defaultValue={dv("addressLine2", contact.addressLine2 ?? "")} placeholder="Line 2 (optional)" /></div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: "2 1 140px" }}><label htmlFor="town">Town</label><input id="town" name="town" defaultValue={dv("town", contact.town ?? "")} /></div>
          <div style={{ flex: "1 1 100px" }}><label htmlFor="pc">Postcode</label><input id="pc" name="postcode" defaultValue={dv("postcode", contact.postcode ?? "")} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: "1 1 140px" }}><label htmlFor="en">Emergency contact</label><input id="en" name="emergencyName" defaultValue={dv("emergencyName", contact.emergencyName ?? "")} placeholder="Name" /></div>
          <div style={{ flex: "1 1 120px" }}><label htmlFor="ep">Their phone</label><input id="ep" type="tel" name="emergencyPhone" defaultValue={dv("emergencyPhone", contact.emergencyPhone ?? "")} /></div>
        </div>
        {e?.form && <p className="banner" role="alert">{e.form}</p>}
        <div className="actions">
          <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <>
      {state.saved && <p className="muted" role="status" style={{ fontSize: 13, marginTop: 6 }}>Saved.</p>}
      <div className="lrows">
        {guardians.map((g) => (
          <div key={g.id} className="lrow" style={{ alignItems: "flex-start" }}>
            <span className="grow">
              <b>{g.name}</b>
              <span className="sub">{REL[g.relationship] ?? g.relationship}{g.isPayer ? ", pays" : ""}</span>
              {g.phone && <a href={tel(g.phone)} style={{ display: "block", fontSize: 14, marginTop: 4 }}>{g.phone}</a>}
              {g.email && <a href={`mailto:${g.email}`} style={{ display: "block", fontSize: 14, marginTop: 2, overflowWrap: "anywhere" }}>{g.email}</a>}
              {!g.phone && !g.email && contact && <span className="sub">No phone or email yet</span>}
            </span>
          </div>
        ))}
        {contact && (
          <>
            <div className="lrow">
              <span className="grow">
                {address.length ? <b style={{ fontWeight: 600 }}>{address.join(", ")}</b> : <span className="muted">Not added</span>}
                <span className="sub">Home address</span>
              </span>
            </div>
            <div className="lrow">
              <span className="grow">
                {contact.emergencyName || contact.emergencyPhone ? (
                  <>
                    <b>{contact.emergencyName || "Emergency contact"}</b>
                    {contact.emergencyPhone && <a href={tel(contact.emergencyPhone)} style={{ display: "block", fontSize: 14, marginTop: 2 }}>{contact.emergencyPhone}</a>}
                  </>
                ) : (
                  <span className="muted">Not added</span>
                )}
                <span className="sub">Emergency contact</span>
              </span>
            </div>
          </>
        )}
      </div>
      {canEdit && contact && (
        <button type="button" className="btn soft sm" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Edit contact details</button>
      )}
    </>
  );
}
