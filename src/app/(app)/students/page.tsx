import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listStudents } from "@/data/students";
import { studentsSummary } from "@/data/dashboard";
import { RankChip, StatusPill } from "@/components/badges";
import { ringColour } from "@/components/ringColour";
import { joinLink } from "@/data/join";
import { emailConfigured } from "@/lib/email";
import { JoinLinkCard } from "./JoinLinkCard";
import { signupPayments } from "@/data/payments";
import { visibleSiteList } from "@/data/club";
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
const SORTS = [
  ["", "Last name"],
  ["first", "First name"],
  ["newest", "Newest first"],
] as const;

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Plus = () => <Icon d="M12 5v14M5 12h14" />;

type Params = { q?: string; status?: string; site?: string; filter?: string; sort?: string; id?: string; tab?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireActor();
  const { q, status, site, filter, sort, id } = await searchParams;
  const selected = id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  // Keep the current filters when moving between students.
  const keepObj = { q, status, site, filter, sort };
  const keep = new URLSearchParams(Object.entries(keepObj).filter(([, v]) => v) as Array<[string, string]>);
  const hrefFor = (sid: string) => {
    const u = new URLSearchParams(keep);
    u.set("id", sid);
    return `/students?${u}`;
  };
  const backHref = keep.size ? `/students?${keep}` : "/students";
  const filterCount = [status, site, filter].filter(Boolean).length;
  const filtering = Boolean(q || filterCount);

  if (!can(actor, "students.view")) {
    return (
      <div className="card">
        <h1 className="section-title">Students</h1>
        <p className="muted" style={{ marginTop: 8 }}>Your role takes registers only. Ask an admin if you need student details.</p>
      </div>
    );
  }

  const [listed, sites] = await Promise.all([listStudents(actor, { q, status, siteId: site, filter }), visibleSiteList(actor)]);
  const students = [...listed].sort((a, b) =>
    sort === "first" ? a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)
    : sort === "newest" ? b.createdAt.getTime() - a.createdAt.getTime()
    : 0,
  );
  const money = can(actor, "payments.view");
  const quick = [
    { key: "", label: "Everyone" },
    { key: "status=active", label: "Active" },
    { key: "status=trial", label: "Trial" },
    { key: "filter=new", label: "Joined in last 30 days" },
    ...(money ? [{ key: "filter=payment-problems", label: "Payment problems" }, { key: "filter=no-dd", label: "No Direct Debit" }] : []),
  ];
  const currentQuick = filter ? `filter=${filter}` : status && !site ? `status=${status}` : !filterCount ? "" : null;

  const canAdd = can(actor, "students.edit");
  const link = canAdd ? <JoinLinkCard url={await joinLink(actor)} emailOn={emailConfigured()} payments={await signupPayments(actor)} /> : null;

  if (listed.length === 0 && !filtering) {
    return (
      <div className="wrap">
        <div className="phead"><div><h1 className="ptitle">Students</h1></div></div>
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
        <div style={{ marginTop: 24 }}>{link}</div>
      </div>
    );
  }

  const summary = selected ? null : await studentsSummary(actor);
  const problems = summary && money ? await listStudents(actor, { filter: "payment-problems" }) : [];

  return (
    <div className="wrap">
      <div className={`sp-wrap${selected ? " on-detail" : ""}`}>
        <div className="show-narrow phead" style={{ marginBottom: 4 }}>
          <div><h1 className="ptitle">Students</h1></div>
          {canAdd && <div className="acts"><Link className="btn primary" href="/students/new"><Plus />Add new student</Link></div>}
        </div>

        <aside className="sp-panel" aria-label="Student list">
          <div className="sp-bar">
            <form role="search" className="sp-search" action="/students">
              <Icon d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5" />
              <label htmlFor="q" className="sr-only">Search students</label>
              <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Search students" autoComplete="off" />
              {status && <input type="hidden" name="status" value={status} />}
              {site && <input type="hidden" name="site" value={site} />}
              {filter && <input type="hidden" name="filter" value={filter} />}
              {sort && <input type="hidden" name="sort" value={sort} />}
            </form>
            <details>
              <summary className={`sp-ib${filterCount ? " on" : ""}`} aria-label="Filter and sort">
                <Icon d="M4 6h16M7 12h10M10 18h4" />
                {filterCount > 0 && <b className="sp-badge">{filterCount}</b>}
              </summary>
              <div className="sp-drawer">
                <h4>Quick filters</h4>
                <nav className="chips" aria-label="Quick filters">
                  {quick.map((f) => (
                    <Link key={f.key} href={`/students${f.key ? `?${f.key}` : ""}`} aria-current={currentQuick === f.key ? "page" : undefined}>{f.label}</Link>
                  ))}
                </nav>
                <form action="/students">
                  {q && <input type="hidden" name="q" value={q} />}
                  {filter && <input type="hidden" name="filter" value={filter} />}
                  <h4><label htmlFor="status">Status</label></h4>
                  <select id="status" name="status" defaultValue={status ?? ""}>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {sites.length > 1 && (
                    <>
                      <h4><label htmlFor="site">Venue</label></h4>
                      <select id="site" name="site" defaultValue={site ?? ""}>
                        <option value="">All venues</option>
                        {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </>
                  )}
                  <h4>Sort by</h4>
                  {SORTS.map(([v, l]) => (
                    <label key={v} className="sp-opt"><input type="radio" name="sort" value={v} defaultChecked={(sort ?? "") === v} />{l}</label>
                  ))}
                  <div className="sp-dfoot">
                    {filtering && <Link className="btn ghost" href="/students">Clear</Link>}
                    <button className="btn primary sm">Show students</button>
                  </div>
                </form>
              </div>
            </details>
          </div>
          <div className="sp-count">
            <span className="num">{students.length} {students.length === 1 ? "student" : "students"}</span>
            {filtering && <Link href="/students" style={{ fontSize: 13 }}>Clear filters</Link>}
          </div>
          <ul className="sp-list">
            {students.map((s) => (
              <li key={s.id}>
                <Link href={hrefFor(s.id)} className="sp-row" aria-current={selected === s.id ? "true" : undefined}>
                  <span className="ring-av" style={{ ["--ring" as string]: ringColour(s.grades[0]?.beltColour) }} aria-hidden="true">{s.firstName[0]}{s.lastName[0]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="sp-name">{s.firstName} <b>{s.lastName}</b></span>
                    <span className="sp-meta">
                      {s.grades.length ? s.grades.slice(0, 2).map((g) => <RankChip key={g.id} grade={g} />) : <RankChip grade={null} />}
                      {s.isNewSignup && <span className="pill hong">New</span>}
                      {s.status !== "active" && <StatusPill status={s.status} />}
                      {s.paymentNotice && <span className="pill bad">! {s.paymentNotice.split(" · ")[0]}</span>}
                      {sites.length > 1 && <span>{s.site}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {students.length === 0 && (
              <li className="muted" style={{ padding: "24px 12px", textAlign: "center", fontSize: 14 }}>No students match. <Link href="/students">Show everyone</Link></li>
            )}
          </ul>
        </aside>

        <section className="sp-detail" aria-label="Student profile">
          {selected ? (
            <ProfileView id={selected} siblingHref={(sid) => hrefFor(sid)} backHref={backHref} compact />
          ) : summary && (
            <>
              <div className="phead">
                <div>
                  <p className="eyebrow">{summary.active} active</p>
                  <h1 className="ptitle">Students</h1>
                  <p className="lede">Pick someone on the left to open their profile.</p>
                </div>
                {canAdd && (
                  <div className="acts">
                    <Link className="btn soft" href="/students/import">Import</Link>
                    <Link className="btn primary" href="/students/new"><Plus />Add new student</Link>
                  </div>
                )}
              </div>
              <section className="kpis four anim" aria-label="Key numbers">
                <Link href="/students?status=active" className="card kpi"><p className="l">Active students</p><p className="v">{summary.active}</p><p className="s">{summary.newStudents} new in 3 months</p></Link>
                <div className="card kpi"><p className="l">No plan set up</p><p className={`v${summary.noPlanCount ? " warn-t" : ""}`}>{summary.noPlanCount}</p><p className="s">need a membership</p></div>
                {money && <Link href="/students?filter=payment-problems" className="card kpi"><p className="l">Payment problems</p><p className={`v${problems.length ? " bad-t" : ""}`}>{problems.length}</p><p className="s">failed or cancelled</p></Link>}
                <div className="card kpi"><p className="l">Absent 7+ days</p><p className={`v${summary.absentCount ? " warn-t" : ""}`}>{summary.absentCount}</p><p className="s">active students</p></div>
              </section>
              <div className="g2 anim" style={{ marginTop: 24 }}>
                <section className="card">
                  <div className="ch"><h2>Needs a look</h2></div>
                  {problems.length + summary.noPlan.length === 0 ? (
                    <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>Nothing to sort out. Everyone has a plan and payments are fine.</p>
                  ) : (
                    <div className="lrows">
                      {problems.slice(0, 3).map((p) => (
                        <div className="lrow" key={`p-${p.id}`}>
                          <span className="ring-av" style={{ ["--ring" as string]: ringColour(p.grades[0]?.beltColour) }} aria-hidden="true">{p.firstName[0]}{p.lastName[0]}</span>
                          <span className="grow"><Link className="b" href={hrefFor(p.id)}>{p.name}</Link><span className="sub">{p.paymentNotice?.split(" · ").slice(1).join(" · ") || p.site}</span></span>
                          <span className="pill bad">! {p.paymentNotice?.split(" · ")[0]}</span>
                        </div>
                      ))}
                      {summary.noPlan.slice(0, 5 - Math.min(problems.length, 3)).map((p) => (
                        <div className="lrow" key={`n-${p.id}`}>
                          <span className="ring-av" aria-hidden="true">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                          <span className="grow"><Link className="b" href={hrefFor(p.id)}>{p.name}</Link><span className="sub">Joined {fmt(p.joinedOn)}</span></span>
                          <span className="pill neutral">No plan</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="card">
                  <div className="ch"><h2>Joined recently</h2><Link href="/students?filter=new">All ›</Link></div>
                  <div className="lrows">
                    {summary.recent.map((r) => (
                      <div className="lrow" key={r.id}>
                        <span className="av" aria-hidden="true">{r.name[0]}</span>
                        <span className="grow"><Link className="b" href={hrefFor(r.id)}>{r.name}</Link><span className="sub">Joined {fmt(r.joinedOn)}{sites.length > 1 ? ` · ${r.site}` : ""}</span></span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              {link && <div id="join" className="anim" style={{ marginTop: 24 }}>{link}</div>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
