"use client";

import { useActionState, useState } from "react";
import { FieldError, errProps } from "@/components/FormBits";
import { domainAction, websiteSettingsAction, type DomainState, type SettingsState } from "./actions";

/** Web address, colour, contact details and the on/off switch. */
export function SettingsPanel({ slug, colour, phone, email, published, base }: { slug: string; colour: string; phone: string; email: string; published: boolean; base: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(websiteSettingsAction, {});
  const e = state.errors;
  const v = state.values;
  const [address, setAddress] = useState(v?.slug ?? slug);
  const [c, setC] = useState(v?.colour ?? colour);
  return (
    <form action={action} className="form" noValidate style={{ maxWidth: "none" }}>
      {state.saved && <p className="banner" role="status">Saved.</p>}
      <div>
        <label htmlFor="w-slug">Junbi web address</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 15 }}>{base.replace(/^https?:\/\//, "")}/c/</span>
          <input id="w-slug" name="slug" value={address} onChange={(ev) => setAddress(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} style={{ flex: "1 1 160px", minWidth: 0 }} {...errProps("slug", e)} />
        </div>
        <FieldError id="slug-err" msg={e?.slug} />
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", margin: 0 }}>
        Club colour
        <input type="color" name="colour" value={c} onChange={(ev) => setC(ev.target.value)} aria-label="Club colour" style={{ width: 44, height: 44, padding: 2 }} />
        <span className="num muted" style={{ fontSize: 13 }}>{c.toUpperCase()}</span>
      </label>
      <div className="grid2">
        <div><label htmlFor="w-phone">Phone (optional)</label><input id="w-phone" name="phone" type="tel" defaultValue={v?.phone ?? phone} /></div>
        <div><label htmlFor="w-email">Email (optional)</label><input id="w-email" name="email" type="email" defaultValue={v?.email ?? email} {...errProps("email", e)} /><FieldError id="email-err" msg={e?.email} /></div>
      </div>
      <label className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="published" defaultChecked={v ? v.published === "on" : published} /> Website is switched on (untick to take it offline)
      </label>
      <div className="actions"><button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

type Record_ = { type: string; name: string; value: string; ok: boolean };

/** Connect the club's own domain, with the DNS records to add and whether they're working yet. */
export function DomainPanel({ domain, records }: { domain: string | null; records: Record_[] | null }) {
  const [state, action, pending] = useActionState<DomainState, FormData>(domainAction, {});
  return (
    <div>
      <form action={action} className="form" noValidate style={{ maxWidth: "none" }}>
        {state.done && <p className="banner" role="status">{state.done}</p>}
        <div>
          <label htmlFor="domain">Your domain</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input id="domain" name="domain" placeholder="e.g. totalcombat.co.uk" defaultValue={domain ?? ""} style={{ flex: "1 1 220px" }} {...errProps("domain", state.errors)} />
            <button className="btn secondary" disabled={pending}>{pending ? "Saving…" : domain ? "Update" : "Connect"}</button>
          </div>
          <FieldError id="domain-err" msg={state.errors?.domain} />
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Don&apos;t have one? Buy one from any domain company (such as 123 Reg, GoDaddy or Namecheap), usually £5 to £15 a year. To disconnect, clear the box and press Update.</p>
        </div>
      </form>
      {domain && records && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Add these records where you bought {domain}</p>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="data" style={{ minWidth: 420 }}>
              <thead><tr><th scope="col">Type</th><th scope="col">Name</th><th scope="col">Value</th><th scope="col">Working?</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.type}>
                    <td>{r.type}</td>
                    <td>{r.name}</td>
                    <td className="num" style={{ wordBreak: "break-all" }}>{r.value}</td>
                    <td>{r.ok ? <span className="pill ok">✓ Yes</span> : <span className="pill neutral">Not yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Changes can take a few hours to work. Once both say Yes, your website shows at {domain} with a secure padlock. Remove any old A or CNAME records for @ and www first.</p>
        </div>
      )}
    </div>
  );
}
