"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { StudentFormState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";
import { disciplineName } from "@/lib/disciplines";

type Option = { id: string; name: string };
type GradeOption = Option & { discipline: string };

/** Belts grouped by art. Clubs with one art get a plain list. */
export function GradeOptions({ grades }: { grades: GradeOption[] }) {
  const arts = [...new Set(grades.map((g) => g.discipline))];
  if (arts.length <= 1) return <>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</>;
  return (
    <>
      {arts.map((a) => (
        <optgroup key={a} label={disciplineName(a)}>
          {grades.filter((g) => g.discipline === a).map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
type Initial = Partial<Record<string, string | boolean | null>>;

export function StudentForm({
  mode,
  action,
  sites,
  grades,
  household,
  initial = {},
  cancelHref,
}: {
  mode: "new" | "edit";
  action: (prev: StudentFormState, f: FormData) => Promise<StudentFormState>;
  sites: Option[];
  grades: GradeOption[];
  household?: Option | null;
  initial?: Initial;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors;
  const v = (k: string) => (state.values ? state.values[k] ?? "" : String(initial[k] ?? ""));
  const checked = (k: string) => (state.values ? state.values[k] === "on" : Boolean(initial[k]));

  return (
    <form action={formAction} className="form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}

      <fieldset>
        <legend>Student</legend>
        <div className="grid2">
          <div>
            <label htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" autoComplete="off" defaultValue={v("firstName")} {...errProps("firstName", e)} />
            <FieldError id="firstName-err" msg={e?.firstName} />
          </div>
          <div>
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" autoComplete="off" defaultValue={v("lastName")} {...errProps("lastName", e)} />
            <FieldError id="lastName-err" msg={e?.lastName} />
          </div>
          <div>
            <label htmlFor="dateOfBirth">Date of birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v("dateOfBirth")} {...errProps("dateOfBirth", e)} />
            <FieldError id="dateOfBirth-err" msg={e?.dateOfBirth} />
          </div>
          <div>
            <label htmlFor="siteId">Site</label>
            <select id="siteId" name="siteId" defaultValue={v("siteId") || sites[0]?.id} {...errProps("siteId", e)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={v("status") || "active"}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="frozen">Frozen</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {mode === "new" && (
            <div>
              <label htmlFor="startingGradeId">Current belt</label>
              <select id="startingGradeId" name="startingGradeId" defaultValue={v("startingGradeId")}>
                <option value="">New starter, no belt yet</option>
                <GradeOptions grades={grades} />
              </select>
            </div>
          )}
        </div>
      </fieldset>

      {mode === "new" &&
        (household ? (
          <>
            <input type="hidden" name="householdId" value={household.id} />
            <p className="banner">Adding to the <strong>{household.name}</strong>. They&apos;ll share contacts and one Direct Debit.</p>
          </>
        ) : (
          <fieldset>
            <legend>Main contact</legend>
            <p className="hint" style={{ marginTop: -8 }}>A parent or guardian for children. For adults, enter the student&apos;s own details.</p>
            <div className="grid2">
              <div>
                <label htmlFor="guardianFirstName">First name</label>
                <input id="guardianFirstName" name="guardianFirstName" defaultValue={v("guardianFirstName")} {...errProps("guardianFirstName", e)} />
                <FieldError id="guardianFirstName-err" msg={e?.guardianFirstName} />
              </div>
              <div>
                <label htmlFor="guardianLastName">Last name</label>
                <input id="guardianLastName" name="guardianLastName" defaultValue={v("guardianLastName")} />
              </div>
              <div>
                <label htmlFor="guardianEmail">Email</label>
                <input id="guardianEmail" name="guardianEmail" type="email" defaultValue={v("guardianEmail")} {...errProps("guardianEmail", e)} />
                <FieldError id="guardianEmail-err" msg={e?.guardianEmail} />
              </div>
              <div>
                <label htmlFor="guardianPhone">Mobile</label>
                <input id="guardianPhone" name="guardianPhone" type="tel" defaultValue={v("guardianPhone")} />
              </div>
              <div>
                <label htmlFor="relationship">Relationship</label>
                <select id="relationship" name="relationship" defaultValue={v("relationship") || "parent"}>
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                  <option value="self">Themselves (adult student)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </fieldset>
        ))}

      {mode === "edit" && (
        <fieldset>
          <legend>Licence</legend>
          <div className="grid2">
            <div>
              <label htmlFor="licenceNumber">Licence number</label>
              <input id="licenceNumber" name="licenceNumber" defaultValue={v("licenceNumber")} />
            </div>
            <div>
              <label htmlFor="licenceExpiresOn">Expires</label>
              <input id="licenceExpiresOn" name="licenceExpiresOn" type="date" defaultValue={v("licenceExpiresOn")} {...errProps("licenceExpiresOn", e)} />
              <FieldError id="licenceExpiresOn-err" msg={e?.licenceExpiresOn} />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>Medical and consent</legend>
        <div>
          <label htmlFor="medicalNotes">Medical notes</label>
          <textarea id="medicalNotes" name="medicalNotes" defaultValue={v("medicalNotes")} placeholder="Allergies, conditions, anything instructors should know" />
          <p className="hint">Only owners, admins and instructors can see this.</p>
        </div>
        <label className="check">
          <input type="checkbox" name="firstAidConsent" defaultChecked={checked("firstAidConsent")} />
          <span>Consent to first aid</span>
        </label>
        <label className="check">
          <input type="checkbox" name="photoConsent" defaultChecked={checked("photoConsent")} />
          <span>Consent to photos and video</span>
        </label>
      </fieldset>

      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Saving…" : mode === "new" ? "Add student" : "Save changes"}
        </button>
        <Link href={cancelHref} className="btn ghost">Cancel</Link>
      </div>
    </form>
  );
}
