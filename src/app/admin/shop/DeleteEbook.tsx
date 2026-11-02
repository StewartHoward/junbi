"use client";

import { useActionState, useState } from "react";
import { deleteEbookAction, type EbookFormState } from "./actions";

export function DeleteEbook({ id, title }: { id: string; title: string }) {
  const [s, run, pending] = useActionState<EbookFormState>(deleteEbookAction.bind(null, id), {});
  const [sure, setSure] = useState(false);
  return (
    <form action={run}>
      {!sure ? (
        <button type="button" className="btn ghost sm bad-t" onClick={() => setSure(true)}>Delete this ebook</button>
      ) : (
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>Delete {title} for good?</span>
          <button type="submit" className="btn primary sm" disabled={pending} style={{ background: "var(--bad, #c8102e)" }}>{pending ? "Deleting…" : "Yes, delete"}</button>
          <button type="button" className="btn ghost sm" onClick={() => setSure(false)}>Keep it</button>
        </span>
      )}
      {s.errors?.form && <p className="bad-t" role="alert" style={{ margin: "8px 0 0", fontSize: 14 }}>{s.errors.form}</p>}
    </form>
  );
}
