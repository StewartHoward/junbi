"use client";

import { useActionState, useState } from "react";
import { addSiteAction, inviteStaffAction, renameClubAction, type ActionState } from "../actions";
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
