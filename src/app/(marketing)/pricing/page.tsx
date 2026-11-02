import Link from "next/link";
import type { Metadata } from "next";
import { jsonLd, pageMeta } from "@/lib/seo";
import { PricingPlans } from "./PricingPlans";

export const metadata: Metadata = pageMeta({ ownImage: true,
  title: "Pricing",
  description: "Flat pricing for UK martial arts clubs from £19 a month. Every feature on every plan, and no percentage of your membership fees, ever.",
  path: "/pricing",
});

// From each provider's published pricing page, checked November 2026. Keep in step with /compare.
const SAVINGS = [
  { club: "Up to 50 students", junbi: "£19", martialytics: "$69", nest: "£77.94" },
  { club: "100 students", junbi: "£39", martialytics: "$99", nest: "£197.64" },
  { club: "200 students, up to 3 sites", junbi: "£69", martialytics: "$129", nest: "£392.05" },
];

const FAQ = [
  { q: "Do you take a percentage of our fees?", a: "No. You pay one flat monthly price. Membership money goes from the parent's bank to yours through your own Stripe or GoCardless account." },
  { q: "What's the difference between the plans?", a: "Only the size of your club. Every plan has every feature: students and families, belts, timetable and registers, Direct Debit and messages to parents." },
  { q: "Which martial arts does Junbi work with?", a: "Taekwondo, Karate, Kickboxing, Judo, Brazilian Jiu-Jitsu, Krav Maga, Muay Thai and MMA, with belt systems ready to go. Teach more than one? Pick them all when you set up." },
  { q: "What counts as an active student?", a: "Anyone on a live membership. Trials, paused and past students are free." },
  { q: "Can you move us from our current system?", a: "Yes. Import your students, families and belts from your current system or a spreadsheet. If you already collect through Stripe, Junbi can take over your Direct Debits without families signing up again." },
  { q: "Can we change plan later?", a: "Any time, up or down." },
  { q: "When can we start?", a: "Today. Sign up, answer a few quick questions and your dashboard is ready. It's free for 7 days and you don't need a card." },
];

export default function PricingPage() {
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faq)} />
      <section className="m-section m-center" style={{ paddingBottom: 48 }}>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(44px, 6vw, 72px)", maxWidth: 860 }}>
          Simple pricing.
          <br />
          Your fees stay yours.
        </h1>
        <p className="m-sub" style={{ maxWidth: 600 }}>One flat monthly price. Every feature on every plan. No percentage of your memberships, ever.</p>
      </section>

      <section style={{ padding: "0 22px 120px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%" }}>
            <PricingPlans />
          </div>
        </div>
        <p className="m-fine m-center" style={{ maxWidth: 820, margin: "28px auto 0", lineHeight: 1.5 }}>
          Prices exclude VAT. Payment fees are charged by Stripe or GoCardless directly, never by Junbi.
        </p>
      </section>

      <section className="m-section alt">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>See what you&apos;d save.</h2>
          <p className="m-sub m-center" style={{ maxWidth: 600, fontSize: 19 }}>
            Monthly cost by club size, from each provider&apos;s published pricing in November 2026. Martialytics prices are in US dollars. NEST figures are the typical monthly fees NEST publishes for clubs of that size.
          </p>
          <div className="m-table-wrap">
            <table className="m-table">
              <thead>
                <tr>
                  <th scope="col">Your club</th>
                  <th scope="col" className="us">Junbi</th>
                  <th scope="col">Martialytics</th>
                  <th scope="col">NEST</th>
                </tr>
              </thead>
              <tbody>
                {SAVINGS.map((r) => (
                  <tr key={r.club}>
                    <th scope="row">{r.club}</th>
                    <td className="us">{r.junbi}</td>
                    <td>{r.martialytics}</td>
                    <td>{r.nest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-center" style={{ margin: "24px 0 0" }}><Link href="/compare" className="m-link">Read the full comparisons</Link></p>
        </div>
      </section>

      <section className="m-section">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>Questions.</h2>
          <div className="m-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section dark m-center">
        <h2 className="m-h2 xl">Ready when you are.</h2>
        <p className="m-sub" style={{ maxWidth: 600 }}>Free for 7 days. Nothing taken until your trial ends, and you can change plan any time.</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn on-dark">Start free trial</Link>
        </div>
      </section>
    </>
  );
}
