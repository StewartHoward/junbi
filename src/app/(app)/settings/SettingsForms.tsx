"use client";

import { useActionState } from "react";
import { addSiteAction, renameClubAction, type ActionState } from "../actions";
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
          <input id="siteName" name="siteName" placeholder="e.g. Preston" defaultValue={state.values?.siteName} {...errProps("siteName", state.errors)} />
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
