import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { classesOn, todayISO, CLUB_TZ } from "@/data/classes";
import { clubArts, getClubOverview, visibleSiteList } from "@/data/club";
import { disciplineName } from "@/lib/disciplines";
import { recentSignups } from "@/data/join";
import { upcomingTrials } from "@/data/leads";
import { dashboardStats, PERIODS, periodKey, type PeriodKey } from "@/data/dashboard";
import { listStudents } from "@/data/students";
import { RankChip } from "@/components/badges";

export const metadata: Metadata = { title: "Dashboard" };

const pounds = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
const n = (v: number) => v.toLocaleString("en-GB");

function change(cur: number, prev: number) {
  if (!prev) return cur ? { text: "New this period", tone: "ok-t" } : { text: "None yet", tone: "" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "Same as previous", tone: "" };
  return pct > 0 ? { text: `▲ ${pct}% vs previous`, tone: "ok-t" } : { text: `▼ ${Math.abs(pct)}% vs previous`, tone: "warn-t" };
}

function chartLabel(iso: string, unit: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return unit === "month" ? d.toLocaleDateString("en-GB", { month: "short" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function weeksAgo(iso: string | null, today: string) {
  if (!iso) return { text: "Never", tone: "neutral" };
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000);
  const w = Math.max(1, Math.floor(days / 7));
  return { text: `${w} wk`, tone: w >= 4 ? "bad" : "warn" };
}

const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ site?: string; period?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const period = periodKey(sp.period);
  const sites = await visibleSiteList(actor);
  const site = sites.find((x) => x.id === sp.site);
  const date = todayISO();
  const people = can(actor, "students.view");
  const money = can(actor, "payments.view");

  const [stats, classesAll, overview, signups, trials, arts, problems] = await Promise.all([
    dashboardStats(actor, { siteId: site?.id, period }),
    classesOn(actor, date),
    getClubOverview(actor),
    recentSignups(actor),
    people ? upcomingTrials(actor) : [],
    clubArts(actor),
    money ? listStudents(actor, { filter: "payment-problems", siteId: site?.id }) : [],
  ]);
  const classes = site ? classesAll.filter((c) => c.siteId === site.id) : classesAll;
  const shownSignups = site ? signups.filter((s) => s.siteId === site.id) : signups;

  const href = (o: { site?: string | null; period?: PeriodKey }) => {
    const u = new URLSearchParams();
    const sv = o.site === undefined ? site?.id : o.site;
    const pv = o.period ?? period;
    if (sv) u.set("site", sv);
    if (pv !== "3m") u.set("period", pv);
    return u.size ? `/today?${u}` : "/today";
  };

  const nice = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthName = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" });
  const trialDays = overview.club.trialEndsOn
    ? Math.round((Date.parse(`${overview.club.trialEndsOn}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000)
    : null;
  const att = change(stats.attendance, stats.attendancePrev);
  const tri = change(stats.trials, stats.trialsPrev);
  const maxBar = Math.max(1, ...stats.chart.map((c) => c.n));
  const last = stats.chart.length - 1;
  const ticks = new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last]);
  const beltRows = stats.belts.filter((b) => b.n > 0).slice(0, 10);
  const maxBelt = Math.max(1, ...beltRows.map((b) => b.n));
  const funnelMax = Math.max(1, stats.trials, stats.came, stats.converted);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const multiArt = arts.length > 1;

  const gettingStarted = [
    { done: overview.activeStudents > 0, label: "Add or import your students", href: "/students", show: can(actor, "students.edit") },
    { done: overview.classCount > 0, label: "Build your timetable", href: "/classes/new", show: can(actor, "classes.manage") },
  ];

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <p className="eyebrow">{nice}</p>
          <h1 className="ptitle">Dashboard</h1>
        </div>
        <div className="acts">
          <span className="live-tag"><span className="live" />Live</span>
          {people && <Link href="/leads" className="btn soft">{stats.newLeads ? `Leads, ${stats.newLeads} to follow up` : "Leads"}</Link>}
          {can(actor, "students.edit") && <Link href="/students/new" className="btn primary"><Plus />Add new student</Link>}
        </div>
      </div>

      <div className="bar-row">
        {sites.length > 1 && (
          <nav className="seg" aria-label="Venue">
            <Link href={href({ site: null })} aria-current={!site ? "true" : undefined}>All venues</Link>
            {sites.map((x) => <Link key={x.id} href={href({ site: x.id })} aria-current={site?.id === x.id ? "true" : undefined}>{x.name}</Link>)}
          </nav>
        )}
        <nav className="seg" aria-label="Period">
          {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
            <Link key={k} href={href({ period: k })} aria-current={period === k ? "true" : undefined}>{PERIODS[k].label}</Link>
          ))}
        </nav>
      </div>

      {trialDays !== null && trialDays >= 0 && can(actor, "club.manage") && (
        <div className="banner" style={{ marginTop: 20 }}>
          {trialDays === 0 ? "Your free trial ends today." : `${trialDays} ${trialDays === 1 ? "day" : "days"} left in your free trial.`}
          {overview.club.founding ? " As a Founding Club you'll get 50% off for six months after that." : ""}
        </div>
      )}

      <section className="kpis three anim" aria-label="Key numbers">
        <Link href="/students?status=active" className="card kpi"><p className="l">Active students</p><p className="v">{n(stats.activeStudents)}</p><p className="s">{stats.newStudents} new in this period</p></Link>
        <div className="card kpi"><p className="l">Members paying</p><p className="v">{n(stats.membersPaying)}</p><p className="s">{stats.joined} joined · {stats.leaving} leaving</p></div>
        <Link href="/classes" className="card kpi"><p className="l">Attendance</p><p className="v">{n(stats.attendance)}</p><p className={`s ${att.tone}`}>{att.text}</p></Link>
        <Link href="/leads" className="card kpi"><p className="l">Trials booked</p><p className="v">{n(stats.trials)}</p><p className={`s ${tri.tone}`}>{tri.text}</p></Link>
        {stats.monthlyPence !== null ? (
          <Link href="/payments" className="card kpi"><p className="l">Monthly memberships</p><p className="v">{pounds(stats.monthlyPence)}</p><p className="s">recurring each month</p></Link>
        ) : (
          <div className="card kpi"><p className="l">Classes today</p><p className="v">{classes.length}</p><p className="s">{classes.reduce((a, c) => a + c.present, 0)} checked in</p></div>
        )}
        <div className="card kpi"><p className="l">Absent 7+ days</p><p className={`v${stats.absentCount ? " warn-t" : ""}`}>{n(stats.absentCount)}</p><p className="s">active students</p></div>
      </section>

      <div className="cols">
        <div className="wide anim">
          <section className="card">
            <div className="ch"><h2>Attendance</h2><span className="m">{stats.perClass ? `${stats.perClass} per class on average` : "No registers taken yet"}</span></div>
            <div className={`cols-chart${stats.chart.length > 14 ? " dense" : ""}`} role="img" aria-label={`Attendance by ${stats.unit} for the last ${PERIODS[period].label}: ${stats.chart.map((c) => c.n).join(", ")}`}>
              {stats.chart.map((c) => (
                <span key={c.start} className={c.n ? undefined : "zero"} style={{ height: `${c.n ? Math.max(4, Math.round((c.n / maxBar) * 100)) : 1}%` }} title={`${chartLabel(c.start, stats.unit)}: ${c.n}`} />
              ))}
            </div>
            <div className="axis" aria-hidden="true">
              {stats.chart.map((c, i) => <span key={c.start}>{ticks.has(i) ? chartLabel(c.start, stats.unit) : ""}</span>)}
            </div>
          </section>

          {stats.plan && (
            <section className="card">
              <div className="ch"><h2>Income</h2>{site ? <span className="m">Whole club</span> : <Link href="/payments">Payments ›</Link>}</div>
              <div className="tiles">
                <div className="tile"><p className="l">Memberships, each month</p><p className="v">{pounds(stats.monthlyPence ?? 0)}</p></div>
                <div className="tile"><p className="l">Collected in {monthName}</p><p className="v">{pounds(stats.plan.collected)}</p></div>
                <div className="tile"><p className="l">On the way</p><p className="v">{pounds(stats.plan.onTheWay)}</p></div>
                <div className="tile"><p className="l">Outstanding</p><p className={`v${stats.plan.outstanding ? " bad-t" : ""}`}>{pounds(stats.plan.outstanding)}</p></div>
              </div>
            </section>
          )}

          <div className="g2">
            <section className="card">
              <div className="ch"><h2>Belts</h2><span className="m">{stats.graded} graded</span></div>
              {beltRows.length === 0 && <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>Belts show here once students have a grade.</p>}
              {beltRows.map((b) => (
                <div className="hbar" key={b.id}>
                  <span className="lab"><RankChip grade={{ name: b.name, beltColour: b.belt_colour }} /></span>
                  <span className="trk"><i style={{ width: `${Math.round((b.n / maxBelt) * 100)}%` }} /></span>
                  <span className="num">{b.n}</span>
                </div>
              ))}
            </section>
            <section className="card">
              <div className="ch"><h2>Trials and conversions</h2>{people && <Link href="/leads">All leads ›</Link>}</div>
              {([["Booked", stats.trials], ["Came to class", stats.came], ["Joined", stats.converted]] as const).map(([label, v]) => (
                <div className="hbar" key={label}>
                  <span className="lab">{label}</span>
                  <span className="trk"><i style={{ width: `${Math.round((v / funnelMax) * 100)}%` }} /></span>
                  <span className="num">{v}</span>
                </div>
              ))}
              <div className="tiles compact">
                <div className="tile"><p className="l">Booked who joined</p><p className="v">{pct(stats.converted, stats.trials)}</p></div>
                <div className="tile"><p className="l">Came who joined</p><p className="v">{pct(stats.converted, stats.came)}</p></div>
                <div className="tile"><p className="l">Days to join</p><p className="v">{stats.daysToJoin ?? "–"}</p></div>
              </div>
            </section>
          </div>
        </div>

        <div className="narrow anim">
          {stats.plan && (
            <section className="card">
              <div className="ch"><h2>Payment status</h2>{site ? <span className="m">Whole club</span> : <Link href="/payments">Details ›</Link>}</div>
              <div className="tiles compact">
                <div className="tile"><p className="l">✓ Paid</p><p className="v ok-t">{stats.plan.paid}</p></div>
                <div className="tile"><p className="l">↻ Processing</p><p className="v warn-t">{stats.plan.processing}</p></div>
                <div className="tile"><p className="l">! To fix</p><p className="v bad-t">{stats.plan.toFix}</p></div>
              </div>
              {problems.length > 0 && (
                <div className="lrows">
                  {problems.slice(0, 4).map((p) => (
                    <div className="lrow" key={p.id}>
                      <Link className="b" href={`/students?id=${p.id}`}>{p.name}</Link>
                      <span className="grow" />
                      <span className="pill bad">{p.paymentNotice?.split(" · ")[0] ?? "Payment problem"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="card">
            <div className="ch"><h2>Classes today</h2><Link href="/classes">Timetable ›</Link></div>
            {classes.length === 0 ? (
              <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>
                No classes today. {can(actor, "classes.manage") && <Link href="/classes/new">Add a class</Link>}
              </p>
            ) : (
              <div className="lrows">
                {classes.map((c) => (
                  <div className="lrow" key={c.id}>
                    <span className="mono">{c.startsAt.slice(0, 5)}</span>
                    <span className="grow"><b>{c.name}</b><span className="sub">{c.site}{multiArt ? ` · ${disciplineName(c.discipline)}` : ""} · {c.present}{c.capacity ? ` of ${c.capacity}` : " in"}</span></span>
                    <Link href={`/classes/${c.id}/register?date=${date}`} className="btn soft sm">Register</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {trials.length > 0 && (
            <section className="card">
              <div className="ch"><h2>Trials coming up</h2><Link href="/leads?show=booked">All ›</Link></div>
              <div className="lrows">
                {trials.slice(0, 5).map((l) => (
                  <div className="lrow" key={l.id}>
                    <span className="mono">{l.sessionAt!.toLocaleString("en-GB", { weekday: "short", timeZone: CLUB_TZ })}</span>
                    <span className="grow">
                      <Link className="b" href={`/leads/${l.id}`}>{l.studentName ?? `${l.firstName} ${l.lastName}`}</Link>
                      <span className="sub">{l.sessionAt!.toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: CLUB_TZ })}{l.className ? ` · ${l.className}` : ""}</span>
                    </span>
                    <span className="pill hong">Trial</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {people && (
            <section className="card">
              <div className="ch"><h2>Absent students</h2><span className="m">7+ days</span></div>
              {stats.absent.length === 0 ? (
                <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>Everyone has been in this week.</p>
              ) : (
                <div className="lrows">
                  {stats.absent.map((a) => {
                    const w = weeksAgo(a.last, date);
                    return (
                      <div className="lrow" key={a.id}>
                        <span className={`pill ${w.tone}`}>{w.text}</span>
                        <span className="grow">
                          <Link className="b" href={`/students?id=${a.id}`}>{a.name}</Link>
                          <span className="sub">{a.last ? `Last in ${new Date(`${a.last}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No classes yet"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {shownSignups.length > 0 && (
            <section className="card">
              <div className="ch"><h2>New sign-ups</h2><Link href="/students?filter=new">All ›</Link></div>
              <div className="lrows">
                {shownSignups.slice(0, 5).map((s) => (
                  <div className="lrow" key={s.id}>
                    <span className="av" aria-hidden="true">{s.firstName[0]}</span>
                    <span className="grow">
                      <Link className="b" href={`/students?id=${s.id}`}>{s.firstName} {s.lastName}</Link>
                      <span className="sub">{s.site} · {s.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: CLUB_TZ })}</span>
                    </span>
                    <span className="pill ok">New</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {gettingStarted.some((g) => g.show && !g.done) && (
            <section className="card">
              <div className="ch"><h2>Getting started</h2></div>
              <div className="lrows">
                {gettingStarted.filter((g) => g.show).map((g) => (
                  <div className="lrow" key={g.label}>
                    <span className="grow">{g.done ? "✓ " : ""}{g.label}</span>
                    {!g.done && <Link href={g.href} className="btn sm primary">Start</Link>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
