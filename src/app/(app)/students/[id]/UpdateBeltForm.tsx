"use client";

import { useActionState } from "react";
import type { StudentFormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";
import { GradeOptions } from "../StudentForm";

export function UpdateBeltForm({
  action,
  grades,
  today,
}: {
  action: (prev: StudentFormState, f: FormData) => Promise<StudentFormState>;
  grades: Array<{ id: string; name: string; discipline: string }>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors;
  if (!grades.length) return <p className="muted" style={{ fontSize: 13 }}>Add belts for your arts in Settings to track them here.</p>;
  return (
    <form action={formAction} className="form" noValidate style={{ maxWidth: "none" }}>
      <div className="grid2">
        <div>
          <label htmlFor="gradeId">New belt</label>
          <select id="gradeId" name="gradeId" defaultValue="" {...errProps("gradeId", e)}>
            <option value="" disabled>Choose a belt</option>
            <GradeOptions grades={grades} />
          </select>
          <FieldError id="gradeId-err" msg={e?.gradeId} />
        </div>
        <div>
          <label htmlFor="gradedOn">Date</label>
          <input id="gradedOn" name="gradedOn" type="date" defaultValue={today} max={today} {...errProps("gradedOn", e)} />
          <FieldError id="gradedOn-err" msg={e?.gradedOn} />
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" disabled={pending}>{pending ? "Saving…" : "Update belt"}</button>
        {state.values && !e && <span role="status" className="muted">Saved</span>}
      </div>
    </form>
  );
}
