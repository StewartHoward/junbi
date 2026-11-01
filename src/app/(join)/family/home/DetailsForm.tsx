"use client";

import { useActionState } from "react";
import type { FamilyState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

type Contact = { addressLine1: string; addressLine2: string; town: string; postcode: string; emergencyName: string; emergencyPhone: string };

/** The parent keeps their phone, address, emergency contact and medical notes up to date. */
export function DetailsForm({ action, phone, contact, children }: { action: (s: FamilyState, f: FormData) => Promise<FamilyState>; phone: string; contact: Contact; children: Array<{ id: string; firstName: string; medicalNotes: string }> }) {
  const [state, run, pending] = useActionState<FamilyState, FormData>(action, {});
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  const e = state.errors;
  return (
    <form key={state.saved ? "saved" : "form"} action={run} className="m-form" noValidate style={{ marginTop: 16 }}>
      {state.saved && <p role="status" style={{ fontWeight: 600 }}>✓ Saved. The club can see your new details.</p>}
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="phone">Your phone</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v("phone", phone)} {...errProps("phone", e)} />
        <FieldError id="phone-err" msg={e?.phone} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div><label htmlFor="addressLine1">Address</label><input id="addressLine1" name="addressLine1" autoComplete="address-line1" defaultValue={v("addressLine1", contact.addressLine1)} /></div>
        <div><label htmlFor="addressLine2">Address line 2</label><input id="addressLine2" name="addressLine2" autoComplete="address-line2" defaultValue={v("addressLine2", contact.addressLine2)} /></div>
        <div><label htmlFor="town">Town</label><input id="town" name="town" autoComplete="address-level2" defaultValue={v("town", contact.town)} /></div>
        <div><label htmlFor="postcode">Postcode</label><input id="postcode" name="postcode" autoComplete="postal-code" defaultValue={v("postcode", contact.postcode)} /></div>
        <div><label htmlFor="emergencyName">Emergency contact</label><input id="emergencyName" name="emergencyName" placeholder="Someone other than you" defaultValue={v("emergencyName", contact.emergencyName)} /></div>
        <div><label htmlFor="emergencyPhone">Their phone</label><input id="emergencyPhone" name="emergencyPhone" type="tel" defaultValue={v("emergencyPhone", contact.emergencyPhone)} /></div>
      </div>
      {children.map((c) => (
        <div key={c.id}>
          <label htmlFor={`med_${c.id}`}>Anything the instructors should know about {c.firstName}?</label>
          <textarea id={`med_${c.id}`} name={`med_${c.id}`} placeholder="Medical conditions, allergies, additional needs" defaultValue={v(`med_${c.id}`, c.medicalNotes)} />
        </div>
      ))}
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}
