import Link from "next/link";

const BELT: Record<string, { bg: string; fg: string }> = {
  yellow: { bg: "#f5c400", fg: "#1d1d1f" },
  green: { bg: "#2e8b3d", fg: "#ffffff" },
  blue: { bg: "#1f4fbf", fg: "#ffffff" },
  red: { bg: "#c8102e", fg: "#ffffff" },
  purple: { bg: "#6b3fa0", fg: "#ffffff" },
};

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const FEATURES = [
  { title: "Students and families", text: "Belts, attendance, medical notes and contacts in one place. Brothers and sisters grouped into one family.", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
  { title: "Classes and timetable", text: "Set up each weekly class once. Junbi gives you a register for it every week, at every site.", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { title: "Registers in seconds", text: "Tap through the class on your phone. Done before the bow.", icon: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M10 12l2 2 3-4" /></> },
  { title: "Direct Debit", text: "Collected through your own Stripe account, straight to your bank. Cards and Apple Pay too.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></> },
  { title: "Messages to parents", text: "Email and text a class, a site or everyone, with your club's name on it.", icon: <path d="M4 5h16v11H8l-4 4z" /> },
  { title: "Every art, every belt", text: "Kup, kyu, dan, stripes or levels. Teach more than one art? Run them all from one login.", icon: <><path d="M3 12h18" /><path d="M10 12l-3 7M14 12l3 7" /><rect x="9" y="9" width="6" height="6" rx="1" /></> },
];

const REGISTER = [
  { name: "Amelia R.", grade: "8th Kup", belt: "yellow", here: true },
  { name: "Oliver T.", grade: "Green belt", belt: "green", here: true },
  { name: "Maya K.", grade: "4th Kyu", belt: "purple", here: false },
  { name: "Noah P.", grade: "Blue belt", belt: "blue", here: true },
];

const PAYMENTS = [
  { who: "The Ahmed family", amount: "£63.00", ok: true },
  { who: "Jack Morris", amount: "£35.00", ok: false },
  { who: "The Clarke family", amount: "£98.00", ok: true },
  { who: "Ella Hughes", amount: "£35.00", ok: true },
];

const ARTS = ["Taekwondo", "Karate", "Kickboxing", "Judo", "Brazilian Jiu-Jitsu", "Krav Maga", "Muay Thai", "MMA"];

export default function Home() {
  return (
    <>
      <section className="m-hero">
        <p className="m-eyebrow">Martial arts club management</p>
        <h1 className="m-hero-title">Your club, ready.</h1>
        <p className="m-sub">Classes, attendance, Direct Debit and messages to parents. One simple system, set up in an evening.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/founding-clubs" className="m-link">Become a Founding Club</Link>
        </div>
        <p className="m-fine">Free for 14 days. No card needed. One flat price, 0% of your fees.</p>

        <div className="m-window" role="img" aria-label="The Junbi dashboard showing today's classes, payments collected and students checked in">
          <div className="m-window-bar"><i /><i /><i /><span style={{ marginLeft: 12 }}>junbi</span></div>
          <div className="m-window-body">
            <div className="m-window-side" aria-hidden="true">
              <span className="on">Today</span><span>Students</span><span>Classes</span><span>Payments</span><span>Messages</span><span>Settings</span>
            </div>
            <div className="m-window-main">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Today</h2>
                <span className="m-sample">Sample data</span>
              </div>
              <div className="m-row" style={{ marginTop: 20 }}>
                <div className="m-stat"><p className="k">Collected this month</p><p className="v">£8,940</p><p className="n" style={{ color: "#1a7f37" }}>✓ 97% of expected</p></div>
                <div className="m-stat"><p className="k">Active students</p><p className="v">264</p><p className="n">2 sites</p></div>
                <div className="m-stat"><p className="k">Checked in today</p><p className="v">58</p><p className="n">4 classes</p></div>
              </div>
              <div className="m-card m-rows" style={{ marginTop: 16 }}>
                <div><strong>17:00 Little Dragons</strong><span style={{ color: "#6e6e73" }}>Taekwondo · 14 here</span></div>
                <div><strong>18:00 Juniors</strong><span style={{ color: "#6e6e73" }}>Kickboxing · 22 here</span></div>
                <div><strong>19:15 Adults</strong><span style={{ color: "#6e6e73" }}>Brazilian Jiu-Jitsu · 18 here</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="m-section dark m-center">
        <h2 className="m-h2 xl">Your fees are yours.</h2>
        <p className="m-sub" style={{ maxWidth: 620 }}>Some club software takes a cut of every membership. Junbi is one flat monthly price, however much your club grows.</p>
        <p className="m-zero">0%</p>
        <p style={{ margin: "8px 0 0", fontSize: 21, color: "#a1a1a6" }}>of your students&apos; fees. Ever.</p>
        <p style={{ margin: "36px 0 0" }}><Link href="/pricing" className="m-link">See pricing</Link></p>
      </section>

      <section id="features" className="m-section alt">
        <div className="m-wrap">
          <h2 className="m-h2 m-center">Everything your club runs on.</h2>
          <p className="m-sub m-center">The everyday jobs every club does, made simple. Nothing you&apos;ll never use.</p>
          <div className="m-tiles">
            {FEATURES.map((f) => (
              <div key={f.title} className="m-tile">
                <Icon d={f.icon} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="registers" className="m-section">
        <div className="m-wrap m-split">
          <div className="copy">
            <p className="m-eyebrow">Attendance</p>
            <h2 className="m-h2">Registers in seconds.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Open today&apos;s class on your phone and tap each student in. Junbi counts every class towards their next belt as you go.</p>
          </div>
          <div className="panel m-panel-alt">
            <div className="m-panel-head"><h3>Juniors · 18:00</h3><span className="m-sample">Sample data</span></div>
            <div className="m-card m-rows" style={{ marginTop: 16, boxShadow: "none" }}>
              {REGISTER.map((r) => (
                <div key={r.name}>
                  <span style={{ flexGrow: 1 }}>{r.name}</span>
                  <span className="m-chip" style={{ background: BELT[r.belt].bg, color: BELT[r.belt].fg }}>{r.grade}</span>
                  {r.here ? <span className="m-ok">✓ Here</span> : <span className="m-warn">Not in yet</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="payments" className="m-section alt">
        <div className="m-wrap m-split reverse">
          <div className="panel m-panel-white">
            <div className="m-panel-head"><h3>October payments</h3><span className="m-sample">Sample data</span></div>
            <div className="m-rows" style={{ marginTop: 12 }}>
              {PAYMENTS.map((p) => (
                <div key={p.who}>
                  <span style={{ flexGrow: 1 }}>{p.who}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.amount}</span>
                  {p.ok ? <span className="m-pill ok">✓ Paid</span> : <span className="m-pill warn">↻ Retrying Fri</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="copy">
            <p className="m-eyebrow">Direct Debit</p>
            <h2 className="m-h2">Paid on time. Every time.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Parents set up Direct Debit on their phone in a minute. Family discounts on the same mandate. Money goes straight to your bank, never through us.</p>
          </div>
        </div>
      </section>

      <section id="arts" className="m-section dark m-center">
        <p className="m-eyebrow">Every art</p>
        <h2 className="m-h2" style={{ maxWidth: 820, margin: "0 auto" }}>Whatever you teach. One login.</h2>
        <p className="m-sub">Pick the arts you teach and Junbi sets up the belts, classes and dashboard to match. Teach more than one? Run them all together.</p>
        <div className="m-arts" aria-label="Martial arts Junbi supports">
          {ARTS.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      </section>

      <section id="switching" className="m-section alt m-center">
        <p className="m-eyebrow">Moving to Junbi</p>
        <h2 className="m-h2" style={{ maxWidth: 820, margin: "0 auto" }}>Switch without the hassle.</h2>
        <p className="m-sub">Bring your students, families and belts across from your current system or a spreadsheet. Founding Clubs get the whole move done for them.</p>
        <p style={{ margin: "32px 0 0" }}><Link href="/founding-clubs" className="m-link">Become a Founding Club</Link></p>
      </section>

      <section className="m-section m-center">
        <h2 className="m-h2 xl">Ready when you are.</h2>
        <p className="m-sub" style={{ maxWidth: 600 }}>The first 100 Founding Clubs get a 30-day trial, 50% off for six months, free migration from their current system, and their price locked for two years.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/founding-clubs" className="m-link">Become a Founding Club</Link>
        </div>
      </section>
    </>
  );
}
