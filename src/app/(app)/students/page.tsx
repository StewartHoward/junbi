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
import { ProfileView } from "./[id]/ProfileView";

export const metadata: Metadata = { title: "Students" };

const STATUSES = [
  ["", "Any status"],
  ["active", "Active"],
  ["trial", "Trial"],
  ["paused", "Paused"],
  ["frozen", "Frozen"],
  ["cancelled", "Left"],
] as const;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; site?: string; filter?: string; id?: string; tab?: string }> }) {
  const actor = await requireActor();
  const { q, status, site, filter, id, tab } = await searchParams;
  const selected = id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  // Keep the current filters when moving between students.
  const keep = new URLSearchParams(Object.entries({ q, status, site, filter }).filter(([, v]) => v) as Array<[string, string]>);
  const hrefFor = (sid: string, t?: string) => {
    const u = new URLSearchParams(keep);
    u.set("id", sid);
    if (t && t !== "overview") u.set("tab", t);
    return `/students?${u}`;
  };
  const backHref = keep.size ? `/students?${keep}` : "/students";
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
          {canAdd && <Link className="btn secondary" href="/students/import">Import</Link>}
          {canAdd && <Link className="btn primary" href="/students/new">Add student</Link>}
        </div>
      </div>

      {!selected && link}

      <div className={`split${selected ? " has-detail" : ""}`} style={{ marginTop: 20 }}>
        <aside className="split-list card" aria-label="Student list">
          <nav className="chips" aria-label="Quick filters">
            {quick.map((f) => (
              <Link key={f.key} href={`/students${f.key ? `?${f.key}` : ""}`} aria-current={currentQuick === f.key ? "page" : undefined}>{f.label}</Link>
            ))}
          </nav>

          <form role="search" className="split-filters">
            <label htmlFor="q" className="sr-only">Search by name</label>
            <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Search by name" />
            <div style={{ display: "flex", gap: 8 }}>
              <label htmlFor="status" className="sr-only">Status</label>
              <select id="status" name="status" defaultValue={status ?? ""} style={{ flex: 1 }}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {sites.length > 1 && (
                <>
                  <label htmlFor="site" className="sr-only">Site</label>
                  <select id="site" name="site" defaultValue={site ?? ""} style={{ flex: 1 }}>
                    <option value="">All sites</option>
                    {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </>
              )}
            </div>
            {filter && <input type="hidden" name="filter" value={filter} />}
            <div className="actions">
              <button className="btn secondary">Filter</button>
              {filtering && <Link className="btn ghost" href="/students">Clear</Link>}
              <span className="muted num" style={{ marginLeft: "auto", fontSize: 13 }}>{students.length} shown</span>
            </div>
          </form>

          <ul className="student-list">
            {students.map((s) => (
              <li key={s.id}>
                <Link href={hrefFor(s.id)} aria-current={selected === s.id ? "true" : undefined}>
                  <span className="sl-name">
                    {s.name}
                    {s.isNewSignup && <span className="pill ready" style={{ marginLeft: 6 }}>New</span>}
                  </span>
                  <span className="sl-meta">
                    {s.grades.length ? s.grades.slice(0, 2).map((g) => <RankChip key={g.id} grade={g} />) : <RankChip grade={null} />}
                    {sites.length > 1 && <span className="muted">{s.site}</span>}
                    {s.status !== "active" && <StatusPill status={s.status} />}
                    {s.paymentNotice && <span className="pill warn">{s.paymentNotice}</span>}
                  </span>
                </Link>
              </li>
            ))}
            {students.length === 0 && (
              <li className="muted" style={{ padding: 12 }}>No students match these filters. <Link href="/students">Show everyone</Link></li>
            )}
          </ul>
        </aside>

        <section className="split-detail" aria-label="Student profile">
          {selected ? (
            <ProfileView id={selected} tab={tab} tabHref={(t) => hrefFor(selected, t)} backHref={backHref} compact />
          ) : (
            <div className="card empty">
              <h2>Choose a student.</h2>
              <p>Pick someone from the list to see their belt, family, membership and payments here.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
