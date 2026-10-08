import Link from "next/link";

const BELT: Record<string, { bg: string; fg: string }> = {
  yellow: { bg: "#f5c400", fg: "#1d1d1f" },
  green: { bg: "#2e8b3d", fg: "#ffffff" },
  blue: { bg: "#1f4fbf", fg: "#ffffff" },
  red: { bg: "#c8102e", fg: "#ffffff" },
};

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const FEATURES = [
  { title: "Student profiles", text: "Belt, attendance, licence, medical notes and payments in one place. Families grouped into one household.", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
  { title: "Direct Debit", text: "BACS Direct Debit through your own GoCardless account. Missed payments retried automatically.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></> },
  { title: "Gradings", text: "Syllabus by kup and dan, a ready-to-grade list, tablet scoring and certificates in one tap.", icon: <><path d="M3 12h18" /><path d="M10 12l-3 7M14 12l3 7" /><rect x="9" y="9" width="6" height="6" rx="1" /></> },
  { title: "Kiosk check-in", text: "An iPad at the door. Students tap in, and your register fills itself.", icon: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 12l2 2 4-4" /></> },
  { title: "Junbi Family app", text: "Parents book, pay and follow belt progress. No more WhatsApp groups.", icon: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></> },
  { title: "Messages", text: "Email, text and push to a class, a grade, a site or everyone.", icon: <path d="M4 5h16v11H8l-4 4z" /> },
];

const READY = [
  { name: "Amelia R.", grade: "8th Kup", belt: "yellow", ready: true },
  { name: "Oliver T.", grade: "6th Kup", belt: "green", ready: true },
  { name: "Maya K.", grade: "4th Kup", belt: "blue", ready: false },
  { name: "Noah P.", grade: "2nd Kup", belt: "red", ready: true },
];

const PAYMENTS = [
  { who: "The Ahmed family", amount: "£63.00", ok: true },
  { who: "Jack Morris", amount: "£35.00", ok: false },
  { who: "The Clarke family", amount: "£98.00", ok: true },
  { who: "Ella Hughes", amount: "£35.00", ok: true },
];

export default function Home() {
  return (
    <>
      <section className="m-hero">
        <p className="m-eyebrow">Taekwondo club management</p>
        <h1 className="m-hero-title">Your club, ready.</h1>
        <p className="m-sub">Members, payments and gradings, all set before the class bows in.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/founding-clubs" className="m-link">Become a Founding Club</Link>
        </div>
        <p className="m-fine">Free for 14 days. No card needed. Built in the UK, for UK taekwondo clubs.</p>

        <div className="m-window" role="img" aria-label="The Junbi dashboard showing today's classes, payments collected and students ready to grade">
          <div className="m-window-bar"><i /><i /><i /><span style={{ marginLeft: 12 }}>yourclub.junbi.app</span></div>
          <div className="m-window-body">
            <div className="m-window-side" aria-hidden="true">
              <span className="on">Today</span><span>Students</span><span>Classes</span><span>Gradings</span><span>Payments</span><span>Messages</span><span>Shop</span><span>Reports</span>
            </div>
            <div className="m-window-main">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Today</h2>
                <span className="m-sample">Sample data</span>
              </div>
              <div className="m-row" style={{ marginTop: 20 }}>
                <div className="m-stat"><p className="k">Collected this month</p><p className="v">£8,940</p><p className="n" style={{ color: "#1a7f37" }}>✓ 97% of expected</p></div>
                <div className="m-stat"><p className="k">Active students</p><p className="v">264</p><p className="n">2 sites</p></div>
                <div className="m-stat"><p className="k">Ready to grade</p><p className="v" style={{ color: "#c8102e" }}>18</p><p className="n">Grading on 15 Nov</p></div>
              </div>
              <div className="m-card m-rows" style={{ marginTop: 16 }}>
                <div><strong>17:00 Tots</strong><span style={{ color: "#6e6e73" }}>Southport · 14 booked</span></div>
                <div><strong>17:45 Juniors, kup grades</strong><span style={{ color: "#6e6e73" }}>Southport · 26 booked</span></div>
                <div><strong>19:00 Adults and black belts</strong><span style={{ color: "#6e6e73" }}>Preston · 21 booked</span></div>
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
        <p style={{ margin: "36px 0 0" }}><Link href="/pricing" className="m-link">Compare plans</Link></p>
      </section>

      <section id="features" className="m-section alt">
        <div className="m-wrap">
          <h2 className="m-h2 m-center">Everything your club runs on.</h2>
          <p className="m-sub m-center">One calm system for instructors, families and students. Built only for taekwondo.</p>
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

      <section id="gradings" className="m-section">
        <div className="m-wrap m-split">
          <div className="copy">
            <p className="m-eyebrow">Junbi Grade</p>
            <h2 className="m-h2">Gradings, handled.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Junbi tracks classes and syllabus for every student, then tells you who is ready. Invite them, take the fee, score on a tablet and print certificates.</p>
          </div>
          <div className="panel m-panel-alt">
            <div className="m-panel-head"><h3>Ready to grade</h3><span className="m-sample">Sample data</span></div>
            <div className="m-card m-rows" style={{ marginTop: 16, boxShadow: "none" }}>
              {READY.map((r) => (
                <div key={r.name}>
                  <span style={{ flexGrow: 1 }}>{r.name}</span>
                  <span className="m-chip" style={{ background: BELT[r.belt].bg, color: BELT[r.belt].fg }}>{r.grade}</span>
                  {r.ready ? <span className="m-ok">✓ Ready</span> : <span className="m-warn">2 classes to go</span>}
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
            <p className="m-eyebrow">Junbi Pay</p>
            <h2 className="m-h2">Paid on time. Every time.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Direct Debit set up on a parent&apos;s phone in a minute. Family discounts, grading fees and kit on the same mandate. Money goes straight to your bank, never through us.</p>
          </div>
        </div>
      </section>

      <section id="associations" className="m-section dark m-center">
        <p className="m-eyebrow">Junbi Association</p>
        <h2 className="m-h2" style={{ maxWidth: 820, margin: "0 auto" }}>One home for every club in your association.</h2>
        <p className="m-sub">A shared licence register, grading calendar and certificates, with a head-office view of every member club.</p>
        <p style={{ margin: "32px 0 0" }}><Link href="/pricing" className="m-link">See Association plans</Link></p>
      </section>

      <section className="m-section m-center">
        <h2 className="m-h2 xl">Ready when you are.</h2>
        <p className="m-sub" style={{ maxWidth: 600 }}>The first 100 Founding Clubs get 50% off for six months, free migration from your current system, and their price locked for two years.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/founding-clubs" className="m-link">Become a Founding Club</Link>
        </div>
      </section>
    </>
  );
}
