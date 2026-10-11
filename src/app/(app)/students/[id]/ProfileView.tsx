import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/auth/session";
import { getStudentProfile } from "@/data/students";
import { ForbiddenError, can } from "@/auth/permissions";
import { disciplineName } from "@/lib/disciplines";
import { todayISO } from "@/data/classes";
import { addMembershipAction, recordBeltAction, updateContactAction } from "../actions";
import { ContactCard } from "./ContactCard";
import { AddMembershipForm } from "./AddMembershipForm";
import { UpdateBeltForm } from "./UpdateBeltForm";
import { BeltSwatch, PaymentPill, RankChip, StatusPill } from "@/components/badges";
import { ringColour } from "@/components/ringColour";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

function lastClass(iso: string | null, today: string) {
  if (!iso) return "No classes yet";
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000);
  if (days <= 0) return "In class today";
  if (days === 1) return "Last class yesterday";
  if (days < 14) return `Last class ${days} days ago`;
  return `Last class ${short(iso)}`;
}

const OUTCOME: Record<string, string> = { pass: "✓ Pass", merit: "✓ Pass, merit", distinction: "✓ Pass, distinction", fail: "Not yet" };

/**
 * A student's profile, laid out like Total HQ: header, then a wide column (belt, attendance, history,
 * payments) and a narrow one (contact, membership, medical, licence). Shown on the right of the Students list.
 */
export async function ProfileView({ id, backHref = "/students", siblingHref, compact = false }: { id: string; backHref?: string; siblingHref?: (id: string) => string; compact?: boolean }) {
  const actor = await requireActor();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // A student at a site this person doesn't cover looks exactly like one that doesn't exist.
  const p = await getStudentProfile(actor, id).catch((e: unknown) => {
    if (e instanceof ForbiddenError) return null;
    throw e;
  });
  if (!p) notFound();

  const today = todayISO();
  const multiArt = new Set(p.gradeOptions.map((g) => g.discipline)).size > 1 || p.belts.length > 1;
  const years = age(p.dateOfBirth);
  const sib = siblingHref ?? ((sid: string) => `/students?id=${sid}`);
  const weeks = p.attendance.weeks;
  const top = Math.max(2, ...weeks.map((w) => w.n));
  const total12 = weeks.reduce((a, w) => a + w.n, 0);
  const ticks = new Set([0, 4, 8, weeks.length - 1]);
  const ready = p.belts.some((b) => b.readyToGrade);
  const licenceOk = p.licence?.expiresOn ? p.licence.expiresOn >= today : null;

  return (
    <>
      {compact && <Link href={backHref} className="sp-back" style={{ fontSize: 15, marginBottom: 8 }}>‹ All students</Link>}

      <div className="phead">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="ring-av lg" style={{ ["--ring" as string]: ringColour(p.belts[0]?.current.grade.beltColour) }} aria-hidden="true">{p.initials}</span>
          <div>
            <p className="eyebrow" style={{ fontSize: 15 }}>
              {years !== null ? `Age ${years} · ` : ""}{p.site} · Member since {fmtDate(p.joinedOn)}
            </p>
            <h1 className="ptitle" style={{ fontSize: 34, lineHeight: "40px" }}>{p.name}</h1>
            <p style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              <StatusPill status={p.status} />
              {p.memberships.length > 0 ? <span className="pill ok">✓ On a plan</span> : <span className="pill neutral">No plan</span>}
              {ready && <span className="pill hong">Ready to grade</span>}
              {p.paymentNotice && <span className="pill bad">! {p.paymentNotice.split(" · ")[0]}</span>}
            </p>
          </div>
        </div>
        {can(actor, "students.edit") && (
          <div className="acts">
            <Link className="btn soft sm" href={`/students/new?household=${p.householdId}`}>Add sibling</Link>
            {can(actor, "messages.send") && <Link className="btn soft sm" href="/messages/new">Message</Link>}
            <Link className="btn primary sm" href={`/students/${p.id}/edit`}>Edit</Link>
          </div>
        )}
      </div>

      <div className="cols tight">
        <div className="wide anim">
          <section className="card">
            <div className="ch"><h2>Belt and rank</h2>{ready && <span className="m">Ready to grade</span>}</div>
            {p.belts.length === 0 && <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>No belt yet. Record one when they grade or if they already hold one.</p>}
            {p.belts.map((b) => (
              <div key={b.discipline} style={{ marginTop: 8 }}>
                <div className="lrow" style={{ borderBottom: "none" }}>
                  <RankChip grade={b.current.grade} />
                  <span className="grow">
                    <b>{multiArt ? disciplineName(b.discipline) : b.current.grade.name}</b>
                    <span className="sub">Graded {fmtDate(b.current.gradedOn)}{b.next ? ` · Next: ${b.next.name}` : " · Top grade"}</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }} aria-label={`${disciplineName(b.discipline)} belt path, currently ${b.current.grade.name}`}>
                  {b.ladder.map((g) => (
                    <BeltSwatch key={g.id} colour={g.beltColour} state={g.sortOrder < b.current.grade.sortOrder ? "done" : g.sortOrder === b.current.grade.sortOrder ? "current" : "todo"} />
                  ))}
                </div>
                <div className="tiles">
                  <div className="tile"><p className="l">Classes since grading</p><p className="v">{b.classesSince}{b.current.grade.classesRequired > 0 && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> of {b.current.grade.classesRequired}</span>}</p></div>
                  <div className="tile"><p className="l">Last graded</p><p className="v sm">{fmtDate(b.current.gradedOn)}</p></div>
                  <div className="tile"><p className="l">Next belt</p><p className="v sm">{b.next?.name ?? "Top grade"}</p></div>
                </div>
              </div>
            ))}
            {can(actor, "grading.record") && (
              <details style={{ marginTop: 18 }}>
                <summary className="btn primary sm" style={{ listStyle: "none" }}>Grade</summary>
                <div style={{ marginTop: 16 }}>
                  <UpdateBeltForm action={recordBeltAction.bind(null, p.id)} grades={p.gradeOptions} today={today} />
                </div>
              </details>
            )}
          </section>

          <section className="card">
            <div className="ch"><h2>Attendance</h2><span className="m">{lastClass(p.attendance.last, today)}</span></div>
            <div className="cols-chart" role="img" aria-label={`Classes each week for the last 12 weeks: ${weeks.map((w) => w.n).join(", ")}`}>
              {weeks.map((w) => (
                <span key={w.start} className={w.n ? undefined : "zero"} style={{ height: `${w.n ? Math.round((Math.min(w.n, top) / top) * 100) : 1}%` }} title={`Week of ${short(w.start)}: ${w.n}`} />
              ))}
            </div>
            <div className="axis" aria-hidden="true">
              {weeks.map((w, i) => <span key={w.start}>{ticks.has(i) ? short(w.start) : ""}</span>)}
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{total12} {total12 === 1 ? "class" : "classes"} in the last 12 weeks</p>
          </section>

          <section className="card">
            <div className="ch"><h2>Belt history</h2></div>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="data" style={{ minWidth: 360 }}>
                <thead><tr><th scope="col">Date</th><th scope="col">Grade</th><th scope="col">Result</th><th scope="col">Examiner</th></tr></thead>
                <tbody>
                  {p.history.map((h) => (
                    <tr key={h.id}>
                      <td className="num">{fmtDate(h.gradedOn)}</td>
                      <td><RankChip grade={{ name: h.grade, beltColour: h.beltColour }} /></td>
                      <td style={{ color: h.outcome === "fail" ? "var(--warning-ink)" : "var(--success)" }}>{OUTCOME[h.outcome]}</td>
                      <td>{h.examiner}</td>
                    </tr>
                  ))}
                  {p.history.length === 0 && <tr><td colSpan={4} className="muted">No belts recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {p.billing && (
            <section className="card">
              <div className="ch"><h2>Transactions</h2><span className="m">Whole family</span></div>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="data num" style={{ minWidth: 360 }}>
                  <thead><tr><th scope="col">Date</th><th scope="col">What</th><th scope="col">Amount</th><th scope="col"><span className="sr-only">Status</span></th></tr></thead>
                  <tbody>
                    {p.billing.payments.slice(0, 12).map((pay) => (
                      <tr key={pay.id}>
                        <td>{fmtDate(pay.chargeDate)}</td>
                        <td>{pay.description}</td>
                        <td>{pay.amount}</td>
                        <td><PaymentPill status={pay.status} /></td>
                      </tr>
                    ))}
                    {p.billing.payments.length === 0 && <tr><td colSpan={4} className="muted">No payments yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="narrow anim">
          <section className="card">
            <div className="ch"><h2>Contact</h2></div>
            <ContactCard guardians={p.guardians} contact={p.contact} action={updateContactAction.bind(null, p.id)} canEdit={can(actor, "students.edit")} />
            {p.siblings.length > 0 && (
              <div className="lrows" style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                {p.siblings.map((x) => (
                  <div className="lrow" key={x.id}>
                    <span className="ring-av" style={{ ["--ring" as string]: ringColour(x.grade?.beltColour) }} aria-hidden="true">{x.firstName[0]}{x.lastName[0]}</span>
                    <span className="grow"><Link className="b" href={sib(x.id)}>{x.firstName} {x.lastName}</Link><span className="sub">Brother or sister</span></span>
                    <RankChip grade={x.grade} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="ch"><h2>Billing plan</h2></div>
            {p.memberships.length === 0 ? (
              <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>No plan yet.</p>
            ) : (
              p.memberships.map((m) => (
                <p key={m.id} style={{ marginTop: 10, fontSize: 15 }}><b>{m.plan}</b>{m.price ? `, ${m.price}` : ""}. Started {fmtDate(m.startsOn)}.</p>
              ))
            )}
            {p.billing && (
              <p style={{ marginTop: 10 }}>
                {p.billing.mandateStatus === "active" ? <span className="pill ok">✓ Direct Debit active</span> : <span className="pill bad">! Direct Debit {p.billing.mandateStatus ?? "not set up"}</span>}
              </p>
            )}
            {can(actor, "students.edit") && <AddMembershipForm action={addMembershipAction.bind(null, p.id)} options={p.planOptions} today={today} signupFee={p.signupFee} />}
          </section>

          {p.medical && (
            <section className="card">
              <div className="ch"><h2>Medical</h2><span className="m">Staff only</span></div>
              <p style={{ marginTop: 10, fontSize: 15 }}>{p.medical.notes || "Nothing recorded."}</p>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Consent to first aid: {p.medical.firstAidConsent ? "given" : "not given"}</p>
            </section>
          )}

          <section className="card">
            <div className="ch"><h2>Licence</h2></div>
            {p.licence ? (
              <>
                <div className="tiles">
                  <div className="tile"><p className="l">Number</p><p className="v sm">{p.licence.number}</p></div>
                  {p.licence.expiresOn && <div className="tile"><p className="l">Expires</p><p className="v sm">{fmtDate(p.licence.expiresOn)}</p></div>}
                </div>
                {licenceOk !== null && <p style={{ marginTop: 12 }}>{licenceOk ? <span className="pill ok">✓ In date</span> : <span className="pill bad">! Expired</span>}</p>}
              </>
            ) : (
              <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>None recorded.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
