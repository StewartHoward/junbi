import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { getStudentProfile } from "@/data/students";
import { ForbiddenError, can } from "@/auth/permissions";
import { BeltSwatch, PaymentPill, RankChip, StatusPill } from "@/components/badges";

export const metadata: Metadata = { title: "Student" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "gradings", label: "Gradings" },
  { key: "payments", label: "Payments" },
] as const;

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

const OUTCOME: Record<string, string> = { pass: "✓ Pass", merit: "✓ Pass, merit", distinction: "✓ Pass, distinction", fail: "Not yet" };

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // A student at a site this person doesn't cover looks exactly like one that doesn't exist.
  const p = await getStudentProfile(actor, id).catch((e: unknown) => {
    if (e instanceof ForbiddenError) return null;
    throw e;
  });
  if (!p) notFound();

  const showPayments = Boolean(p.billing);
  const tabs = TABS.filter((t) => t.key !== "payments" || showPayments);
  const active = tabs.some((t) => t.key === tab) ? tab : "overview";
  const currentOrder = p.current?.grade.sortOrder ?? -1;
  const years = age(p.dateOfBirth);

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/students">Students</Link> › {p.name}
      </p>

      <header style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
        <div aria-hidden="true" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ink)", color: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 600 }}>
          {p.initials}
        </div>
        <div style={{ flexGrow: 1, minWidth: 240 }}>
          <h1 className="page-title">{p.name}</h1>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
            <RankChip grade={p.current?.grade ?? null} />
            <StatusPill status={p.status} />
            {p.readyToGrade && <span className="pill ready">Ready to grade</span>}
            {p.paymentNotice && <span className="pill warn">{p.paymentNotice}</span>}
            <span className="muted">
              {years !== null ? `Age ${years} · ` : ""}
              {p.site} · Member since {fmtDate(p.joinedOn)}
            </span>
          </div>
        </div>
        {can(actor, "students.edit") && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="btn secondary" href={`/students/new?household=${p.householdId}`}>Add sibling</Link>
            <Link className="btn primary" href={`/students/${p.id}/edit`}>Edit</Link>
          </div>
        )}
      </header>

      <nav className="tabs" aria-label="Profile sections">
        {tabs.map((t) => (
          <Link key={t.key} href={`/students/${p.id}?tab=${t.key}`} aria-current={active === t.key ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {active === "overview" && (
        <div className="row" style={{ marginTop: 24 }}>
          <section className="card" style={{ flex: "2 1 520px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <h2 className="section-title">Belt journey</h2>
              {p.next && <span className="muted" style={{ fontSize: 13 }}>Next: {p.next.name}</span>}
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 6 }} aria-label={`Belt path, currently ${p.current?.grade.name ?? "new starter"}`}>
              {p.ladder.map((g) => (
                <BeltSwatch key={g.id} colour={g.beltColour} state={g.sortOrder < currentOrder ? "done" : g.sortOrder === currentOrder ? "current" : "todo"} />
              ))}
            </div>
            <div className="muted" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{p.ladder[0]?.name}</span>
              <span>{p.ladder.at(-1)?.name}</span>
            </div>

            <div className="row" style={{ marginTop: 24, gap: 16 }}>
              <div style={{ flex: "1 1 180px", background: "var(--surface-alt)", borderRadius: "var(--radius-md)", padding: 16 }}>
                <p className="muted" style={{ fontSize: 13 }}>Classes since last grading</p>
                <p className="num" style={{ marginTop: 4, fontSize: 28, fontWeight: 600 }}>
                  {p.classesSince}{" "}
                  {p.current && <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>of {p.current.grade.classesRequired} needed</span>}
                </p>
              </div>
              <div style={{ flex: "1 1 180px", background: "var(--surface-alt)", borderRadius: "var(--radius-md)", padding: 16 }}>
                <p className="muted" style={{ fontSize: 13 }}>Last graded</p>
                <p style={{ marginTop: 4, fontSize: 28, fontWeight: 600 }}>{p.current ? fmtDate(p.current.gradedOn) : "Not yet"}</p>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>Syllabus tracking is coming soon.</p>
          </section>

          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card">
              <h2 className="section-title">Family</h2>
              <div className="list" style={{ marginTop: 10 }}>
                {p.guardians.map((g) => (
                  <div key={g.id}>
                    <span>{g.name}</span>
                    <span className="muted" style={{ fontSize: 13, textAlign: "right" }}>
                      {g.relationship}
                      {g.email ? <><br />{g.email}</> : null}
                    </span>
                  </div>
                ))}
                {p.siblings.map((sib) => (
                  <div key={sib.id}>
                    <Link href={`/students/${sib.id}`}>{sib.firstName} {sib.lastName}</Link>
                    <RankChip grade={sib.grade} />
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Membership</h2>
              <div className="list" style={{ marginTop: 10 }}>
                {p.membership && (
                  <div>
                    <span className="muted">Plan</span>
                    <span>{p.membership.plan}{p.membership.price ? ` · ${p.membership.price}` : ""}</span>
                  </div>
                )}
                {p.billing && (
                  <div>
                    <span className="muted">Direct Debit</span>
                    {p.billing.mandateStatus === "active" ? <span className="pill ok">✓ Active</span> : <span className="pill bad">! {p.billing.mandateStatus ?? "None"}</span>}
                  </div>
                )}
                <div>
                  <span className="muted">Licence</span>
                  <span>{p.licence ? `Valid to ${fmtDate(p.licence.expiresOn)}` : "None yet"}</span>
                </div>
              </div>
            </section>

            {p.medical && (
              <section className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h2 className="section-title">Medical</h2>
                  <span className="muted" style={{ fontSize: 12 }}>Staff only</span>
                </div>
                <p style={{ marginTop: 10 }}>{p.medical.notes || "Nothing recorded."}</p>
                <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Consent to first aid: {p.medical.firstAidConsent ? "given" : "not given"}</p>
              </section>
            )}
          </div>
        </div>
      )}

      {active === "gradings" && (
        <section className="card table-wrap" style={{ marginTop: 24, padding: "8px 24px" }}>
          <table className="data" style={{ minWidth: 480 }}>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Grade</th><th scope="col">Result</th><th scope="col">Examiner</th></tr>
            </thead>
            <tbody>
              {p.history.map((h) => (
                <tr key={h.id}>
                  <td className="num">{fmtDate(h.gradedOn)}</td>
                  <td><RankChip grade={{ name: h.grade, beltColour: h.beltColour }} /></td>
                  <td style={{ color: h.outcome === "fail" ? "var(--warning-ink)" : "var(--success)" }}>{OUTCOME[h.outcome]}</td>
                  <td>{h.examiner}</td>
                </tr>
              ))}
              {p.history.length === 0 && <tr><td colSpan={4} className="muted">No gradings yet.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {active === "payments" && p.billing && (
        <section className="card table-wrap" style={{ marginTop: 24, padding: "8px 24px" }}>
          <table className="data num" style={{ minWidth: 480 }}>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {p.billing.payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{fmtDate(pay.chargeDate)}</td>
                  <td>{pay.description}</td>
                  <td>{pay.amount}</td>
                  <td><PaymentPill status={pay.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ margin: "12px 0", fontSize: 13 }}>Payments shown are for the whole household.</p>
        </section>
      )}
    </>
  );
}
