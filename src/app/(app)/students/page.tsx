import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listStudents } from "@/data/students";
import { RankChip, StatusPill } from "@/components/badges";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor();
  const { q } = await searchParams;

  if (!can(actor, "students.view")) {
    return (
      <div className="card">
        <h1 className="section-title">Students</h1>
        <p className="muted" style={{ marginTop: 8 }}>Your role takes registers only. Ask an admin if you need student details.</p>
      </div>
    );
  }

  const students = await listStudents(actor, { q });

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 className="page-title">Students</h1>
        <span className="muted num">{students.length} shown</span>
      </div>

      <form role="search" style={{ marginTop: 20 }}>
        <label htmlFor="q" className="muted" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          Search by name
        </label>
        <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="e.g. Taylor" />
      </form>

      <div className="card table-wrap" style={{ marginTop: 20, padding: "8px 24px" }}>
        <table className="data" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Grade</th>
              <th scope="col">Site</th>
              <th scope="col">Status</th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/students/${s.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {s.name}
                  </Link>
                </td>
                <td><RankChip grade={s.grade} /></td>
                <td>{s.site}</td>
                <td><StatusPill status={s.status} /></td>
                <td>{s.paymentNotice ? <span className="pill warn">{s.paymentNotice}</span> : null}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No students match “{q}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
