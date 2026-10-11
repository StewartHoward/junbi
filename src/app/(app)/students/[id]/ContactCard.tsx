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
  const address = contact ? [contact.addressLine1, contact.addressLine2, contact.town, contact.postcode].filter(Boolean) : [];

  if (editing && contact) {
    return (
      <form action={run} className="form" noValidate style={{ maxWidth: "none", marginTop: 10 }}>
        {guardians.map((g) => (
          <fieldset key={g.id} style={{ border: "1px solid var(--line-soft)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <legend className="muted" style={{ fontSize: 13, padding: "0 4px" }}>{REL[g.relationship] ?? "Contact"}</legend>
            <input type="hidden" name="guardianId" value={g.id} />
            <div className="row" style={{ gap: 8 }}>
              <div style={{ flex: "1 1 120px" }}><label htmlFor={`gf-${g.id}`}>First name</label><input id={`gf-${g.id}`} name={`g_${g.id}_firstName`} defaultValue={g.firstName} /></div>
              <div style={{ flex: "1 1 120px" }}><label htmlFor={`gl-${g.id}`}>Last name</label><input id={`gl-${g.id}`} name={`g_${g.id}_lastName`} defaultValue={g.lastName} /></div>
            </div>
            <div style={{ marginTop: 8 }}><label htmlFor={`ge-${g.id}`}>Email</label><input id={`ge-${g.id}`} type="email" name={`g_${g.id}_email`} defaultValue={g.email ?? ""} /></div>
            <div style={{ marginTop: 8 }}><label htmlFor={`gp-${g.id}`}>Phone</label><input id={`gp-${g.id}`} type="tel" name={`g_${g.id}_phone`} defaultValue={g.phone ?? ""} /></div>
          </fieldset>
        ))}
        {Object.entries(e ?? {}).filter(([k]) => k.startsWith("guardians.")).map(([k, v]) => <FieldError key={k} id={k} msg={v} />)}
        <div><label htmlFor="a1">Address</label><input id="a1" name="addressLine1" defaultValue={contact.addressLine1 ?? ""} placeholder="House number and street" /></div>
        <div><label htmlFor="a2" className="sr-only">Address line 2</label><input id="a2" name="addressLine2" defaultValue={contact.addressLine2 ?? ""} placeholder="Line 2 (optional)" /></div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: "2 1 140px" }}><label htmlFor="town">Town</label><input id="town" name="town" defaultValue={contact.town ?? ""} /></div>
          <div style={{ flex: "1 1 100px" }}><label htmlFor="pc">Postcode</label><input id="pc" name="postcode" defaultValue={contact.postcode ?? ""} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: "1 1 140px" }}><label htmlFor="en">Emergency contact</label><input id="en" name="emergencyName" defaultValue={contact.emergencyName ?? ""} placeholder="Name" /></div>
          <div style={{ flex: "1 1 120px" }}><label htmlFor="ep">Their phone</label><input id="ep" type="tel" name="emergencyPhone" defaultValue={contact.emergencyPhone ?? ""} /></div>
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
      <div className="list" style={{ marginTop: 10 }}>
        {guardians.map((g) => (
          <div key={g.id} style={{ alignItems: "flex-start" }}>
            <span>
              <strong>{g.name}</strong>
              <span className="muted" style={{ fontSize: 13 }}> · {REL[g.relationship] ?? g.relationship}{g.isPayer ? ", pays" : ""}</span>
            </span>
            <span style={{ textAlign: "right", fontSize: 14 }}>
              {g.phone && <a href={tel(g.phone)}>{g.phone}</a>}
              {g.phone && g.email && <br />}
              {g.email && <a href={`mailto:${g.email}`}>{g.email}</a>}
              {!g.phone && !g.email && contact && <span className="muted">No contact details</span>}
            </span>
          </div>
        ))}
        {contact && (
          <>
            <div style={{ alignItems: "flex-start" }}>
              <span className="muted">Address</span>
              <span style={{ textAlign: "right", fontSize: 14 }}>{address.length ? address.map((l, i) => <span key={i}>{l}<br /></span>) : <span className="muted">Not added</span>}</span>
            </div>
            <div style={{ alignItems: "flex-start" }}>
              <span className="muted">Emergency contact</span>
              <span style={{ textAlign: "right", fontSize: 14 }}>
                {contact.emergencyName || contact.emergencyPhone ? (
                  <>
                    {contact.emergencyName}
                    {contact.emergencyPhone && <><br /><a href={tel(contact.emergencyPhone)}>{contact.emergencyPhone}</a></>}
                  </>
                ) : (
                  <span className="muted">Not added</span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
      {canEdit && contact && (
        <button type="button" className="btn secondary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Edit contact details</button>
      )}
    </>
  );
}
