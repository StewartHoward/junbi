import Link from "next/link";
import type { Metadata } from "next";
import { adminClubs, type AdminClub } from "@/data/admin";
import { todayISO } from "@/data/classes";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Junbi admin" };

const pounds = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: pence % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

function ago(d: Date | null) {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return day(d);
}

const SHOW = [
  ["", "All clubs"],
  ["trial", "On trial"],
  ["paying", "Trial ended"],
  ["free", "Free"],
] as const;

const STATUS_PILL: Record<AdminClub["fee"]["status"], string> = { trial: "blue", paying: "ok", free: "neutral" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const { show, q } = await searchParams;
  const clubs = await adminClubs();
  const today = todayISO();
  const now = Date.now();

  const recent = clubs.filter((c) => now - c.createdAt.getTime() < 30 * 86_400_000).length;
  const trial = clubs.filter((c) => c.fee.status === "trial");
  const endingSoon = trial.filter((c) => c.trialEndsOn && Date.parse(`${c.trialEndsOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= 3 * 86_400_000).length;
  const paying = clubs.filter((c) => c.fee.status === "paying");
  const free = clubs.filter((c) => c.fee.status === "free");
  const mrr = paying.reduce((a, c) => a + c.fee.pence, 0);
  const afterTrials = trial.reduce((a, c) => a + c.fee.listPence * (c.founding ? 0.5 : 1), 0);
  const students = clubs.reduce((a, c) => a + c.studentsActive, 0);
  const newStudents = clubs.reduce((a, c) => a + c.studentsNew30d, 0);
  const familiesPaying = clubs.reduce((a, c) => a + c.familiesPaying, 0);
  const founding = clubs.filter((c) => c.founding).length;

  // Sign-ups per month for the last 12 months.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (11 - i));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), n: 0 };
  });
  for (const c of clubs) {
    const m = months.find((x) => x.key === c.createdAt.toISOString().slice(0, 7));
    if (m) m.n++;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.n));
  const byPlan = PLANS.map((p) => ({ name: p.name, n: clubs.filter((c) => c.plan === p.id).length })).filter((p) => p.n > 0 || p.name !== "Association");
  const maxPlan = Math.max(1, ...byPlan.map((p) => p.n));

  const term = q?.trim().toLowerCase();
  const shown = clubs
    .filter((c) => !show || c.fee.status === show)
    .filter((c) => !term || [c.name, c.ownerName, c.ownerEmail].some((v) => v?.toLowerCase().includes(term)));
  const href = (s: string) => {
    const u = new URLSearchParams();
    if (s) u.set("show", s);
    if (q) u.set("q", q);
    return u.size ? `/admin?${u}` : "/admin";
  };

  return (
    <div className="wrap">
      <div className="phead">
        <div>
          <p className="eyebrow">{new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="ptitle">Junbi admin</h1>
        </div>
        <div className="acts"><span className="live-tag"><span className="live" />Live</span></div>
      </div>

      <div className="banner" style={{ marginTop: 20 }}>
        Junbi isn&apos;t charging clubs yet. The fees below are what each club will pay once billing is switched on, after its trial and any discount.
      </div>

      <section className="kpis three anim" aria-label="Key numbers">
        <div className="card kpi"><p className="l">Clubs signed up</p><p className="v">{clubs.length}</p><p className="s">{recent} new in the last 30 days</p></div>
        <div className="card kpi"><p className="l">On free trial</p><p className="v">{trial.length}</p><p className={`s${endingSoon ? " warn-t" : ""}`}>{endingSoon} ending in the next 3 days</p></div>
        <div className="card kpi"><p className="l">Past their trial</p><p className="v">{paying.length}</p><p className="s">will pay once billing is on · {free.length} free</p></div>
        <div className="card kpi"><p className="l">Monthly revenue due</p><p className="v">{pounds(mrr)}</p><p className="s">{afterTrials ? `+ about ${pounds(afterTrials)} when trials end` : "from paying clubs"}</p></div>
        <div className="card kpi"><p className="l">Students on Junbi</p><p className="v">{students.toLocaleString("en-GB")}</p><p className="s">{newStudents} added in the last 30 days</p></div>
        <div className="card kpi"><p className="l">Families on Direct Debit</p><p className="v">{familiesPaying.toLocaleString("en-GB")}</p><p className="s">{founding} Founding {founding === 1 ? "Club" : "Clubs"}</p></div>
      </section>

      <div className="g2 anim" style={{ marginTop: 24 }}>
        <section className="card">
          <div className="ch"><h2>Sign-ups</h2><span className="m">Clubs per month</span></div>
          <div className="cols-chart" role="img" aria-label={`Clubs signed up each month: ${months.map((m) => `${m.label} ${m.n}`).join(", ")}`}>
            {months.map((m) => <span key={m.key} className={m.n ? undefined : "zero"} style={{ height: `${m.n ? Math.max(6, Math.round((m.n / maxMonth) * 100)) : 1}%` }} title={`${m.label}: ${m.n}`} />)}
          </div>
          <div className="axis" aria-hidden="true">{months.map((m, i) => <span key={m.key}>{i % 3 === 0 || i === 11 ? m.label : ""}</span>)}</div>
        </section>
        <section className="card">
          <div className="ch"><h2>Plans</h2><span className="m">{clubs.length} clubs</span></div>
          {byPlan.map((p) => (
            <div className="hbar" key={p.name}>
              <span className="lab">{p.name}</span>
              <span className="trk"><i style={{ width: `${Math.round((p.n / maxPlan) * 100)}%` }} /></span>
              <span className="num">{p.n}</span>
            </div>
          ))}
          <div className="tiles compact">
            <div className="tile"><p className="l">Trial</p><p className="v">{trial.length}</p></div>
            <div className="tile"><p className="l">Trial ended</p><p className="v ok-t">{paying.length}</p></div>
            <div className="tile"><p className="l">Free</p><p className="v">{free.length}</p></div>
          </div>
        </section>
      </div>

      <section className="card anim" style={{ marginTop: 24 }}>
        <div className="ch">
          <h2>Clubs</h2>
          <form action="/admin" role="search" style={{ display: "flex", gap: 8 }}>
            {show && <input type="hidden" name="show" value={show} />}
            <label htmlFor="q" className="sr-only">Search clubs</label>
            <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Search club, owner or email" style={{ minHeight: 40, width: 260 }} />
          </form>
        </div>
        <nav className="seg" aria-label="Show" style={{ marginTop: 16 }}>
          {SHOW.map(([k, l]) => <Link key={k} href={href(k)} aria-current={(show ?? "") === k ? "true" : undefined}>{l}</Link>)}
        </nav>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th scope="col">Club</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Junbi fee</th>
                <th scope="col">Students</th><th scope="col">Sites</th><th scope="col">Family payments</th><th scope="col">Last sign-in</th><th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>{c.founding && <span className="pill hong" style={{ marginLeft: 6, fontSize: 11 }}>Founding</span>}
                    <span className="sub">{c.ownerName ?? "No owner"}{c.ownerEmail ? <> · <a href={`mailto:${c.ownerEmail}`}>{c.ownerEmail}</a></> : null}</span>
                    {!c.setUp && <span className="sub warn-t">Hasn&apos;t finished set-up</span>}
                  </td>
                  <td>{c.planName}<span className="sub">{pounds(c.fee.listPence)} list</span></td>
                  <td><span className={`pill ${STATUS_PILL[c.fee.status]}`}>{c.fee.status === "trial" ? "Trial" : c.fee.status === "free" ? "Free" : "Trial ended"}</span><span className="sub">{c.fee.note}{c.promoCode ? ` · ${c.promoCode}` : ""}</span></td>
                  <td className="num"><b>{c.fee.status === "trial" ? "–" : pounds(c.fee.pence)}</b><span className="sub">a month</span></td>
                  <td className="num"><b>{c.studentsActive}</b><span className="sub">{c.studentsNew30d ? `+${c.studentsNew30d} in 30 days` : `${c.studentsTotal} in total`}</span></td>
                  <td className="num">{c.sites}<span className="sub">{c.staff} staff</span></td>
                  <td>{c.paymentProvider ? (c.paymentProvider === "stripe" ? "Stripe" : "GoCardless") : <span className="muted">Not connected</span>}<span className="sub">{c.familiesPaying} on DD · {pounds(c.collected30dPence)} in 30 days</span></td>
                  <td>{ago(c.lastSignIn)}</td>
                  <td className="num">{day(c.createdAt)}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={9} className="muted">No clubs match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
