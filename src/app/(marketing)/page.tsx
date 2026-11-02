import Link from "next/link";
import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { CountUp, Reveal } from "./Motion";
import { featureOn } from "@/data/features";

// Re-checked every few minutes so feature switches on the admin page show here.
export const revalidate = 300;

export const metadata: Metadata = pageMeta({
  title: "Martial Arts Club Management Software · Junbi",
  absoluteTitle: true,
  description: "Club management software for UK martial arts clubs: classes, attendance, Direct Debit, gradings and your club website, for one flat price. Your fees stay yours.",
  path: "/",
});

const prices = PLANS.map((p) => p.monthlyPence / 100);
const STRUCTURED = [
  { "@context": "https://schema.org", "@type": "Organization", name: "Junbi", url: SITE_URL, logo: `${SITE_URL}/apple-icon`, email: "hello@junbi.co.uk", areaServed: "GB" },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Junbi",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: "Club management software for UK martial arts clubs: students and families, classes and registers, Direct Debit, gradings, a club shop and a club website.",
    offers: { "@type": "AggregateOffer", priceCurrency: "GBP", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length },
  },
];

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

const FEATURE_LINK: Record<string, string> = { "Classes and timetable": "/features/registers", "Registers in seconds": "/features/registers", "Direct Debit": "/features/direct-debit", "Students and families": "/features/parent-login" };

const FEATURES = [
  { title: "Students and families", text: "Belts, attendance, medical notes and contacts in one place. Brothers and sisters grouped into one family.", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
  { title: "Classes and timetable", text: "Set up each weekly class once. Junbi gives you a register for it every week, at every site.", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { title: "Registers in seconds", text: "Tap through the class on your phone. Done before the bow.", icon: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M10 12l2 2 3-4" /></> },
  { title: "Direct Debit", text: "Collected through your own Stripe or GoCardless account, straight to your bank. Parents set it up when they sign up.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></> },
  { title: "Messages to parents", text: "Email a class, a site or everyone, with your club's name on it.", icon: <path d="M4 5h16v11H8l-4 4z" /> },
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
const ART_LINK: Record<string, string> = { Taekwondo: "taekwondo", Karate: "karate", Kickboxing: "kickboxing", Judo: "judo", "Brazilian Jiu-Jitsu": "brazilian-jiu-jitsu" };

export default async function Home() {
  const parentLogin = await featureOn("family");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(STRUCTURED)} />
      <section className="m-hero">
        <p className="m-eyebrow">Martial arts club management</p>
        <h1 className="m-hero-title">Your club, ready.</h1>
        <p className="m-sub">Classes, attendance, Direct Debit and messages to parents. One simple system, set up in an evening.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/pricing" className="m-link">See pricing</Link>
        </div>
        <p className="m-fine">Free for 7 days. Nothing taken until your trial ends. One flat price, 0% of your fees.</p>

        <div className="m-window" role="img" aria-label="The Junbi dashboard showing today's classes, payments collected and students checked in">
          <div className="m-window-bar"><i /><i /><i /><span style={{ marginLeft: 12 }}>junbi</span></div>
          <div className="m-window-body">
            <div className="m-window-side" aria-hidden="true">
              <span className="on">Today</span><span>Students</span><span>Classes</span><span>Payments</span><span>Messages</span><span>Settings</span>
            </div>
            <Reveal className="m-window-main">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Today</h2>
                <span className="m-sample">Sample data</span>
              </div>
              <div className="m-row" style={{ marginTop: 20 }}>
                <div className="m-stat"><p className="k">Collected this month</p><p className="v"><CountUp to={8940} prefix="£" duration={1800} /></p><p className="n" style={{ color: "#1a7f37" }}>✓ <CountUp to={97} suffix="%" duration={1800} /> of expected</p></div>
                <div className="m-stat"><p className="k">Active students</p><p className="v"><CountUp to={264} duration={1600} delay={150} /></p><p className="n">2 sites</p></div>
                <div className="m-stat"><p className="k">Checked in today</p><p className="v"><CountUp to={58} duration={1400} delay={300} /></p><p className="n">4 classes</p></div>
              </div>
              <div className="m-card m-rows" style={{ marginTop: 16 }}>
                {[["17:00 Little Dragons", "Taekwondo", 14], ["18:00 Juniors", "Kickboxing", 22], ["19:15 Adults", "Brazilian Jiu-Jitsu", 18]].map(([cls, art, n], i) => (
                  <div key={cls} data-anim="up" style={{ "--i": i, "--d": "500ms" } as React.CSSProperties}><strong>{cls}</strong><span style={{ color: "#6e6e73" }}>{art} · <CountUp to={n as number} delay={700 + i * 120} duration={1000} /> here</span></div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="m-section dark m-center">
        <h2 className="m-h2 xl">Your fees are yours.</h2>
        <p className="m-sub" style={{ maxWidth: 620 }}>Some club software takes a cut of every membership. Junbi is one flat monthly price, however much your club grows.</p>
        <p className="m-zero"><CountUp from={6} to={0} suffix="%" duration={1600} delay={200} /></p>
        <p style={{ margin: "8px 0 0", fontSize: 21, color: "#a1a1a6" }}>of your students&apos; fees. Ever.</p>
        <p style={{ margin: "36px 0 0" }}><Link href="/pricing" className="m-link">See pricing</Link></p>
      </section>

      <section id="features" className="m-section alt">
        <div className="m-wrap">
          <h2 className="m-h2 m-center">Everything your club runs on.</h2>
          <p className="m-sub m-center">The everyday jobs every club does, made simple. Nothing you&apos;ll never use.</p>
          <p className="m-center" style={{ margin: "12px 0 0" }}><Link href="/features" className="m-link">See every feature</Link></p>
          <Reveal className="m-tiles">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="m-tile" data-anim="up" style={{ "--i": i } as React.CSSProperties}>
                <Icon d={f.icon} />
                <h3>{FEATURE_LINK[f.title] && (parentLogin || f.title !== "Students and families") ? <Link href={FEATURE_LINK[f.title]} style={{ color: "inherit" }}>{f.title}</Link> : f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section id="registers" className="m-section">
        <div className="m-wrap m-split">
          <div className="copy">
            <p className="m-eyebrow">Attendance</p>
            <h2 className="m-h2">Registers in seconds.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Open today&apos;s class on your phone and tap each student in. Junbi counts every class towards their next belt as you go.</p>
          </div>
          <Reveal className="panel m-panel-alt">
            <div className="m-panel-head"><h3>Juniors · 18:00</h3><span className="m-sample">Sample data</span></div>
            <div className="m-card m-rows" style={{ marginTop: 16, boxShadow: "none" }}>
              {REGISTER.map((r, i) => (
                <div key={r.name}>
                  <span style={{ flexGrow: 1 }}>{r.name}</span>
                  <span className="m-chip" data-anim="belt" style={{ background: BELT[r.belt].bg, color: BELT[r.belt].fg, "--i": i } as React.CSSProperties}>{r.grade}</span>
                  {r.here ? <span className="m-ok" data-anim="pop" style={{ "--i": i * 3, "--d": "700ms" } as React.CSSProperties}>✓ Here</span> : <span className="m-warn" data-anim="pop" style={{ "--i": i * 3, "--d": "700ms" } as React.CSSProperties}>Not in yet</span>}
                </div>
              ))}
            </div>
            <div className="m-progress" data-anim="up" style={{ "--d": "1500ms" } as React.CSSProperties}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15 }}>
                <span><b>Oliver T.</b> to blue belt</span>
                <span style={{ color: "#6e6e73" }}><CountUp from={0} to={22} delay={1700} duration={1600} /> of 24 classes</span>
              </div>
              <div className="m-progress-track" aria-hidden="true">
                <span className="m-progress-bar" data-anim="fill" style={{ width: "91.7%", background: `linear-gradient(90deg, ${BELT.green.bg}, ${BELT.blue.bg})`, "--d": "1700ms" } as React.CSSProperties} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="payments" className="m-section alt">
        <div className="m-wrap m-split reverse">
          <Reveal className="panel m-panel-white">
            <div className="m-panel-head"><h3>October payments</h3><span className="m-sample">Sample data</span></div>
            <div className="m-rows" style={{ marginTop: 12 }}>
              {PAYMENTS.map((p, i) => (
                <div key={p.who} data-anim="up" style={{ "--i": i } as React.CSSProperties}>
                  <span style={{ flexGrow: 1 }}>{p.who}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.amount}</span>
                  {p.ok ? <span className="m-pill ok" data-anim="pop" style={{ "--i": i * 2, "--d": "600ms" } as React.CSSProperties}>✓ Paid</span> : <span className="m-pill warn" data-anim="pop" style={{ "--i": i * 2, "--d": "600ms" } as React.CSSProperties}>↻ Retrying Fri</span>}
                </div>
              ))}
            </div>
          </Reveal>
          <div className="copy">
            <p className="m-eyebrow">Direct Debit</p>
            <h2 className="m-h2">Paid on time. Every time.</h2>
            <p className="m-sub" style={{ margin: "20px 0 0" }}>Parents set up Direct Debit on their phone as they sign up, with one Direct Debit for the whole family. Use Stripe or GoCardless. Money goes straight to your bank, never through us.</p>
          </div>
        </div>
      </section>

      <section id="arts" className="m-section dark m-center">
        <p className="m-eyebrow">Every art</p>
        <h2 className="m-h2" style={{ maxWidth: 820, margin: "0 auto" }}>Whatever you teach. One login.</h2>
        <p className="m-sub">Pick the arts you teach and Junbi sets up the belts, classes and dashboard to match. Teach more than one? Run them all together.</p>
        <Reveal className="m-arts">
          {ARTS.map((a, i) => (
            ART_LINK[a] ? <Link key={a} href={`/club-software/${ART_LINK[a]}`} data-anim="up" style={{ color: "inherit", textDecoration: "none", "--i": i } as React.CSSProperties}><span>{a}</span></Link> : <span key={a} data-anim="up" style={{ "--i": i } as React.CSSProperties}>{a}</span>
          ))}
        </Reveal>
      </section>

      <section id="switching" className="m-section alt m-center">
        <p className="m-eyebrow">Moving to Junbi</p>
        <h2 className="m-h2" style={{ maxWidth: 820, margin: "0 auto" }}>Switch without the hassle.</h2>
        <p className="m-sub">Bring your students, families and belts across from your current system or a spreadsheet. Already collecting through Stripe? Families don&apos;t need to sign up again.</p>
        <p style={{ margin: "32px 0 0" }}><Link href="/guides/switching-without-re-signing-families" className="m-link">How switching works</Link></p>
      </section>

      <section className="m-section m-center">
        <h2 className="m-h2 xl">Ready when you are.</h2>
        <p className="m-sub" style={{ maxWidth: 600 }}>Every feature on every plan, from £19 a month. Free for 7 days, and 0% of your fees, ever.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/pricing" className="m-link">See pricing</Link>
        </div>
      </section>
    </>
  );
}
