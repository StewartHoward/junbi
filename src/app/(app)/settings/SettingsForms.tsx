"use client";

import { useActionState, useState } from "react";
import { addSiteAction, applyPromoCodeAction, inviteStaffAction, removeSiteAction, renameClubAction, updateSiteAction, type ActionState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

export function ClubNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameClubAction, {});
  return (
    <form action={action} className="form" noValidate>
      <div>
        <label htmlFor="name">Club name</label>
        <input id="name" name="name" defaultValue={name} {...errProps("name", state.errors)} />
        <FieldError id="name-err" msg={state.errors?.name} />
      </div>
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.saved && <span role="status" className="muted">Saved</span>}
      </div>
    </form>
  );
}

export function AddSiteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSiteAction, {});
  return (
    <form action={action} className="form" noValidate key={state.saved ? Date.now() : "form"}>
      <div className="grid2">
        <div>
          <label htmlFor="siteName">New site name</label>
          <input id="siteName" name="siteName" placeholder="e.g. the town or venue" defaultValue={state.values?.siteName} {...errProps("siteName", state.errors)} />
          <FieldError id="siteName-err" msg={state.errors?.siteName} />
        </div>
        <div>
          <label htmlFor="siteAddress">Address (optional)</label>
          <input id="siteAddress" name="siteAddress" defaultValue={state.values?.siteAddress} />
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" disabled={pending}>{pending ? "Adding…" : "Add site"}</button>
        {state.saved && <span role="status" className="muted">Site added</span>}
      </div>
    </form>
  );
}

/** One site in Settings: name and address, with Edit and Remove. */
export function SiteRow({ site, canEdit, canRemove }: { site: { id: string; name: string; address: string | null }; canEdit: boolean; canRemove: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, save, saving] = useActionState<ActionState, FormData>(async (p, f) => {
    const r = await updateSiteAction(site.id, p, f);
    if (r.saved) setEditing(false);
    return r;
  }, {});
  const [removed, remove, removing] = useActionState<ActionState, FormData>(removeSiteAction.bind(null, site.id), {});
  if (editing) {
    return (
      <form action={save} className="form" noValidate style={{ maxWidth: "none", display: "block", padding: "12px 0" }}>
        <div className="grid2">
          <div>
            <label htmlFor={`sn-${site.id}`}>Site name</label>
            <input id={`sn-${site.id}`} name="siteName" defaultValue={saved.values?.siteName ?? site.name} {...errProps("siteName", saved.errors)} />
            <FieldError id="siteName-err" msg={saved.errors?.siteName} />
          </div>
          <div>
            <label htmlFor={`sa-${site.id}`}>Address</label>
            <input id={`sa-${site.id}`} name="siteAddress" defaultValue={saved.values?.siteAddress ?? site.address ?? ""} />
          </div>
        </div>
        {saved.errors?.form && <p className="banner" role="alert">{saved.errors.form}</p>}
        <div className="actions">
          <button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }
  return (
    <div style={{ flexWrap: "wrap" }}>
      <span><strong>{site.name}</strong>{site.address ? <span className="muted"> · {site.address}</span> : null}</span>
      <span className="actions">
        {canEdit && <button type="button" className="btn ghost" onClick={() => setEditing(true)} aria-label={`Edit ${site.name}`}>Edit</button>}
        {canRemove && !confirm && <button type="button" className="btn ghost" onClick={() => setConfirm(true)} aria-label={`Remove ${site.name}`}>Remove</button>}
        {canRemove && confirm && (
          <form action={remove} className="actions">
            <button className="btn secondary" disabled={removing}>{removing ? "Removing…" : `Yes, remove ${site.name}`}</button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Keep</button>
          </form>
        )}
      </span>
      {removed.errors?.form && <p className="banner" role="alert" style={{ flexBasis: "100%", marginTop: 8 }}>{removed.errors.form}</p>}
    </div>
  );
}

export function InviteStaffForm({ sites, canInviteAdmin }: { sites: Array<{ id: string; name: string }>; canInviteAdmin: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteStaffAction, {});
  const [role, setRole] = useState("instructor");
  const e = state.errors;
  return (
    <form action={action} className="form" noValidate key={state.saved ? `sent-${state.values?.email}` : "form"} style={{ maxWidth: "none" }}>
      {state.saved && <p role="status" className="banner">Invitation sent to {state.values?.email}.</p>}
      <div className="grid2">
        <div>
          <label htmlFor="invite-email">Email</label>
          <input id="invite-email" name="email" type="email" autoComplete="off" defaultValue={state.saved ? "" : state.values?.email} {...errProps("email", e)} />
          <FieldError id="email-err" msg={e?.email} />
        </div>
        <div>
          <label htmlFor="invite-role">Role</label>
          <select id="invite-role" name="role" value={role} onChange={(ev) => setRole(ev.target.value)} {...errProps("role", e)}>
            {canInviteAdmin && <option value="admin">Admin: everything except billing</option>}
            <option value="instructor">Instructor: students, registers and belts</option>
            <option value="assistant">Assistant: registers only</option>
          </select>
          <FieldError id="role-err" msg={e?.role} />
        </div>
      </div>
      {role !== "admin" && sites.length > 0 && (
        <fieldset>
          <legend style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Sites they cover</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {sites.map((site) => (
              <label key={site.id} className="check">
                <input type="checkbox" name="siteIds" value={site.id} defaultChecked={sites.length === 1} />
                <span>{site.name}</span>
              </label>
            ))}
          </div>
          <FieldError id="siteIds-err" msg={e?.siteIds} />
        </fieldset>
      )}
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
      </div>
    </form>
  );
}

export function PromoCodeForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(applyPromoCodeAction, {});
  return (
    <form action={action} className="form" noValidate>
      <div>
        <label htmlFor="promoCode">Have a code?</label>
        <input id="promoCode" name="promoCode" autoComplete="off" autoCapitalize="characters" defaultValue={state.values?.promoCode} {...errProps("promoCode", state.errors)} />
        <FieldError id="promoCode-err" msg={state.errors?.promoCode} />
      </div>
      <div className="actions">
        <button className="btn secondary" disabled={pending}>{pending ? "Applying…" : "Apply code"}</button>
      </div>
    </form>
  );
}
