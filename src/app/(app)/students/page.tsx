import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listStudents } from "@/data/students";
import { RankChip, StatusPill } from "@/components/badges";
import { joinLink } from "@/data/join";
import { emailConfigured } from "@/lib/email";
import { JoinLinkCard } from "./JoinLinkCard";
import { signupPayments } from "@/data/payments";
import { getClubOverview } from "@/data/club";

export const metadata: Metadata = { title: "Students" };

const STATUSES = [
  ["", "Any status"],
  ["active", "Active"],
  ["trial", "Trial"],
  ["paused", "Paused"],
  ["frozen", "Frozen"],
  ["cancelled", "Left"],
] as const;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; site?: string; filter?: string }> }) {
  const actor = await requireActor();
  const { q, status, site, filter } = await searchParams;
  const filtering = Boolean(q || status || site || filter);

  if (!can(actor, "students.view")) {
    return (
      <div className="card">
        <h1 className="section-title">Students</h1>
        <p className="muted" style={{ marginTop: 8 }}>Your role takes registers only. Ask an admin if you need student details.</p>
      </div>
    );
  }

  const [students, overview] = await Promise.all([listStudents(actor, { q, status, siteId: site, filter }), getClubOverview(actor)]);
  const sites = overview.sites.filter((x) => actor.sites === "all" || actor.sites.includes(x.id));
  const money = can(actor, "payments.view");
  const quick = [
    { key: "", label: "All" },
    { key: "status=active", label: "Active" },
    { key: "status=trial", label: "Trial" },
    { key: "filter=new", label: "Joined in last 30 days" },
    ...(money ? [{ key: "filter=payment-problems", label: "Payment problems" }, { key: "filter=no-dd", label: "No Direct Debit" }] : []),
  ];
  const currentQuick = filter ? `filter=${filter}` : status && !q && !site ? `status=${status}` : !filtering ? "" : null;

  const canAdd = can(actor, "students.edit");
  const link = canAdd ? <div id="join"><JoinLinkCard url={await joinLink(actor)} emailOn={emailConfigured()} payments={await signupPayments(actor)} /></div> : null;

  if (students.length === 0 && !filtering) {
    return (
      <>
        <h1 className="page-title">Students</h1>
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Add your first student.</h2>
          <p>Each student gets a profile with their belt, family contacts, medical notes and attendance.</p>
          {canAdd && (
            <div className="actions" style={{ justifyContent: "center" }}>
              <Link className="btn primary" href="/students/new">Add a student</Link>
              <Link className="btn secondary" href="/students/import">Import from a spreadsheet</Link>
            </div>
          )}
        </div>
        {link}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <h1 className="page-title">Students</h1>
        <div className="actions">
          <span className="muted num">{students.length} shown</span>
          {canAdd && <Link className="btn secondary" href="/students/import">Import</Link>}
          {canAdd && <Link className="btn primary" href="/students/new">Add student</Link>}
        </div>
      </div>

      {link}

      <nav className="tabs" aria-label="Quick filters" style={{ marginTop: 20 }}>
        {quick.map((f) => (
          <Link key={f.key} href={`/students${f.key ? `?${f.key}` : ""}`} aria-current={currentQuick === f.key ? "page" : undefined}>{f.label}</Link>
        ))}
      </nav>

      <form role="search" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 220px" }}>
          <label htmlFor="q" className="muted" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Search by name</label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="e.g. Taylor" />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label htmlFor="status" className="muted" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Status</label>
          <select id="status" name="status" defaultValue={status ?? ""}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {sites.length > 1 && (
          <div style={{ flex: "1 1 150px" }}>
            <label htmlFor="site" className="muted" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Site</label>
            <select id="site" name="site" defaultValue={site ?? ""}>
              <option value="">All sites</option>
              {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        )}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <div className="actions">
          <button className="btn secondary">Filter</button>
          {filtering && <Link className="btn ghost" href="/students">Clear</Link>}
        </div>
      </form>

      <div className="card table-wrap" style={{ marginTop: 20, padding: "8px 24px" }}>
        <table className="data" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Belt</th>
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
                  {s.isNewSignup && <span className="pill ready" style={{ marginLeft: 8 }}>New sign-up</span>}
                </td>
                <td><span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>{s.grades.length ? s.grades.map((g) => <RankChip key={g.id} grade={g} />) : <RankChip grade={null} />}</span></td>
                <td>{s.site}</td>
                <td><StatusPill status={s.status} /></td>
                <td>{s.paymentNotice ? <span className="pill warn">{s.paymentNotice}</span> : null}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No students match these filters. <Link href="/students">Show everyone</Link></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
