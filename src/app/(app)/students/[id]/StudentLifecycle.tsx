"use client";

import { useActionState, useState } from "react";
import { archiveStudentAction, deleteStudentAction, restoreStudentAction, type ArchiveState } from "../actions";

/** Archive (they've left, keep their history), restore, or delete for good. */
export function StudentLifecycle({ id, name, archived, canDelete }: { id: string; name: string; archived: boolean; canDelete: boolean }) {
  const [a, archive, archiving] = useActionState<ArchiveState>((archived ? restoreStudentAction : archiveStudentAction).bind(null, id), {});
  const [d, del, deleting] = useActionState<ArchiveState, FormData>(deleteStudentAction.bind(null, id), {});
  const [sure, setSure] = useState<"" | "archive" | "delete">("");
  return (
    <section className="card">
      <div className="ch"><h2>{archived ? "Archived" : "Leaving the club"}</h2></div>
      {archived ? (
        <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>{name} is archived: hidden from your lists, registers and messages, with their history kept. Restore them if they come back.</p>
      ) : (
        <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>Archive {name} if they&apos;ve left. They come off your lists, registers and messages, and you keep their belts and attendance in case they return.</p>
      )}
      {a.errors?.form && <p className="error" role="alert" style={{ marginTop: 10 }}>{a.errors.form}</p>}
      <form action={archive} style={{ marginTop: 12 }}>
        {archived ? (
          <button className="btn secondary sm" disabled={archiving}>{archiving ? "Restoring…" : "Restore student"}</button>
        ) : sure === "archive" ? (
          <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span>Archive {name}?</span>
            <button className="btn primary sm" disabled={archiving}>{archiving ? "Archiving…" : "Yes, archive"}</button>
            <button type="button" className="btn ghost sm" onClick={() => setSure("")}>Cancel</button>
          </span>
        ) : (
          <button type="button" className="btn secondary sm" onClick={() => setSure("archive")}>Archive student</button>
        )}
      </form>

      {canDelete && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
          <p style={{ fontWeight: 600 }}>Delete for good</p>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Removes {name} and their attendance, belts, memberships and bookings. This can&apos;t be undone. Usually archiving is better.</p>
          {sure !== "delete" ? (
            <button type="button" className="btn ghost sm" style={{ marginTop: 10, color: "var(--bad, #c8102e)" }} onClick={() => setSure("delete")}>Delete student</button>
          ) : (
            <form action={del} className="form" style={{ marginTop: 10, maxWidth: 420 }}>
              {d.errors?.form && <p className="error" role="alert">{d.errors.form}</p>}
              <label htmlFor="confirm">Type <b>{name}</b> to confirm</label>
              <input id="confirm" name="confirm" autoComplete="off" aria-invalid={d.errors?.confirm ? true : undefined} aria-describedby={d.errors?.confirm ? "confirm-err" : undefined} />
              {d.errors?.confirm && <p id="confirm-err" className="error" role="alert">{d.errors.confirm}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className="btn primary sm" disabled={deleting} style={{ background: "var(--bad, #c8102e)" }}>{deleting ? "Deleting…" : "Delete for good"}</button>
                <button type="button" className="btn ghost sm" onClick={() => setSure("")}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
