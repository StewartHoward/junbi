"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importStudentsAction, type ImportState } from "../actions";
import { FieldError } from "@/components/FormBits";
import { IMPORT_FIELDS } from "@/lib/import";

type Option = { id: string; name: string };
const SHOW_ROWS = 300;

export function ImportFlow({ sites, arts }: { sites: Option[]; arts: Option[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStudentsAction, {});
  const e = state.errors;

  if (state.done) {
    const d = state.done;
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <h2 className="section-title">Done. {d.students} {d.students === 1 ? "student" : "students"} imported.</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          {d.families} new {d.families === 1 ? "family" : "families"} and {d.belts} {d.belts === 1 ? "belt" : "belts"} added.
        </p>
        <div className="actions" style={{ marginTop: 16 }}>
          <Link href="/students" className="btn primary">See your students</Link>
          <form action={action}>
            <input type="hidden" name="intent" value="reset" />
            <button className="btn secondary">Import another file</button>
          </form>
        </div>
      </div>
    );
  }

  const p = state.preview;
  const defaults = (
    <div className="grid2">
      <div>
        <label htmlFor="siteId">Site, if the file doesn&apos;t say</label>
        <select id="siteId" name="siteId" defaultValue={state.siteId || sites[0]?.id}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {arts.length > 0 && (
        <div>
          <label htmlFor="discipline">Martial art, if the file doesn&apos;t say</label>
          <select id="discipline" name="discipline" defaultValue={state.discipline || arts[0]?.id}>
            {arts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  if (!p) {
    return (
      <form action={action} className="card form" style={{ marginTop: 24, maxWidth: "none" }} noValidate>
        {e?.form && <p className="error" role="alert">{e.form}</p>}
        <div>
          <label htmlFor="file">Your spreadsheet (CSV)</label>
          <input id="file" name="file" type="file" accept=".csv,.tsv,.txt,text/csv" aria-describedby={e?.file ? "file-err" : "file-hint"} />
          {e?.file ? <FieldError id="file-err" msg={e.file} /> : (
            <p id="file-hint" className="hint">
              One row per student. In Excel or Numbers use File, Save As, CSV. Not sure what columns to use? <a href="/junbi-import-template.csv" download>Download our template</a>.
            </p>
          )}
        </div>
        {defaults}
        <input type="hidden" name="intent" value="preview" />
        <div className="actions">
          <button className="btn primary" disabled={pending}>{pending ? "Reading your file…" : "Check my file"}</button>
        </div>
      </form>
    );
  }

  const s = p.summary;
  const sorted = [...p.rows].sort((a, b) => Number(!!b.skip) - Number(!!a.skip) || b.warnings.length - a.warnings.length || a.line - b.line);
  return (
    <form action={action} style={{ marginTop: 24 }} noValidate>
      <input type="hidden" name="csv" value={state.csv} />
      <input type="hidden" name="fileName" value={state.fileName} />

      <div className="card">
        <div className="head">
          <h2 className="section-title">{state.fileName || "Your file"}</h2>
          <button className="btn ghost" name="intent" value="reset" disabled={pending}>Choose a different file</button>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <div className="card stat"><div className="label">Students to import</div><div className="value num">{s.toImport}</div></div>
          <div className="card stat"><div className="label">New families</div><div className="value num">{s.newFamilies}</div></div>
          <div className="card stat"><div className="label">With a belt</div><div className="value num">{s.withBelt}</div></div>
          <div className="card stat"><div className="label">Skipped</div><div className="value num">{s.skipped}</div></div>
        </div>
        {s.existingFamilies > 0 && (
          <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
            {s.existingFamilies} {s.existingFamilies === 1 ? "family is" : "families are"} already in Junbi, so those students join them.
          </p>
        )}
        {s.withWarnings > 0 && (
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            {s.withWarnings} {s.withWarnings === 1 ? "row needs" : "rows need"} a quick look. They&apos;re at the top of the list below and will still import.
          </p>
        )}
      </div>

      <details className="card" style={{ marginTop: 20 }} open={!!e?.mapping}>
        <summary className="section-title" style={{ cursor: "pointer" }}>Columns and defaults</summary>
        <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>We matched your columns automatically. Change any that are wrong, then press Update.</p>
        <FieldError id="mapping-err" msg={e?.mapping} />
        <div className="grid2" style={{ marginTop: 12 }}>
          {IMPORT_FIELDS.map((f) => (
            <div key={f.id}>
              <label htmlFor={`map_${f.id}`}>{f.label}</label>
              <select id={`map_${f.id}`} name={`map_${f.id}`} defaultValue={String(p.mapping[f.id] ?? -1)}>
                <option value="-1">Not in my file</option>
                {p.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>{defaults}</div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn secondary" name="intent" value="preview" disabled={pending}>Update</button>
        </div>
      </details>

      <div className="card table-wrap" style={{ marginTop: 20, padding: "8px 24px" }}>
        <table className="data" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Student</th>
              <th scope="col">Born</th>
              <th scope="col">Family contact</th>
              <th scope="col">Belt</th>
              <th scope="col">Site</th>
              <th scope="col">Check</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, SHOW_ROWS).map((r) => (
              <tr key={r.line} style={r.skip ? { opacity: 0.6 } : undefined}>
                <td className="num muted">{r.line}</td>
                <td>{r.firstName || "?"} {r.lastName}</td>
                <td className="num">{r.dateOfBirth ? new Date(`${r.dateOfBirth}T12:00:00Z`).toLocaleDateString("en-GB") : ""}</td>
                <td>
                  {r.contact.relationship === "self" ? "Themselves" : `${r.contact.firstName} ${r.contact.lastName}`}
                  {r.existingHouseholdId && <span className="pill neutral" style={{ marginLeft: 6 }}>Existing family</span>}
                  <div className="muted" style={{ fontSize: 12 }}>{r.contact.email ?? r.contact.phone ?? ""}</div>
                </td>
                <td>{r.gradeName ?? <span className="muted">None</span>}</td>
                <td>{r.siteName}</td>
                <td style={{ fontSize: 13 }}>
                  {r.skip ? <span className="pill bad">Skipped: {r.skip}</span> : r.warnings.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  ) : <span className="pill ok">Ready</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > SHOW_ROWS && <p className="muted" style={{ fontSize: 13, padding: "12px 0" }}>Showing the first {SHOW_ROWS} of {sorted.length} rows. All of them will import.</p>}
      </div>

      {e?.form && <p className="error" role="alert" style={{ marginTop: 16 }}>{e.form}</p>}
      <div className="actions" style={{ marginTop: 20 }}>
        <button className="btn primary" name="intent" value="import" disabled={pending || s.toImport === 0}>
          {pending ? "Working…" : `Import ${s.toImport} ${s.toImport === 1 ? "student" : "students"}`}
        </button>
        <Link href="/students" className="btn ghost">Cancel</Link>
      </div>
    </form>
  );
}
