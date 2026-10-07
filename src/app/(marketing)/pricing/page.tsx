import Link from "next/link";
import type { Metadata } from "next";
import { PricingPlans } from "./PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, flat pricing for UK taekwondo clubs from £19 a month. No percentage of your membership fees, ever.",
};

const SAVINGS = [
  { club: "40 students, 1 site", junbi: "£19", martialytics: "£29", allsorted: "£69", nest: "£84 to £112" },
  { club: "120 students, 1 site", junbi: "£39", martialytics: "£49", allsorted: "£69", nest: "£252 to £336" },
  { club: "300 students, 2 sites", junbi: "£69", martialytics: "£69", allsorted: "£138", nest: "£630 to £840" },
];

const FAQ = [
  { q: "Do you take a percentage of our fees?", a: "No. You pay one flat monthly price. Membership money goes from the parent's bank to yours through your own GoCardless account." },
  { q: "What counts as an active student?", a: "Anyone on a live membership. Trials, leads, paused and past students are free." },
  { q: "Can you move us from our current system?", a: "Yes. We import students, families and grades from NEST, Martialytics, other systems or a spreadsheet. Founding Clubs get the whole move done for them, free." },
  { q: "Can we change plan later?", a: "Any time, up or down. We work out the difference to the day." },
  { q: "When can we start?", a: "Today. Sign up, answer three quick questions and your dashboard is ready. It's free for 30 days and you don't need a card." },
];

export default function PricingPage() {
  return (
    <>
      <section className="m-section m-center" style={{ paddingBottom: 48 }}>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(44px, 6vw, 72px)", maxWidth: 860 }}>
          Simple pricing.
          <br />
          Your fees stay yours.
        </h1>
        <p className="m-sub" style={{ maxWidth: 600 }}>One flat monthly price. Every core feature on every plan. No percentage of your memberships, ever.</p>
      </section>

      <section style={{ padding: "0 22px 120px" }}>
        <PricingPlans />
        <p className="m-fine m-center" style={{ maxWidth: 820, margin: "28px auto 0", lineHeight: 1.5 }}>
          Prices exclude VAT. Payment fees are charged by GoCardless and Stripe directly, never by Junbi. UK Direct Debit is 1% + 20p per payment, capped at £4. SMS is charged at cost.
        </p>
      </section>

      <section className="m-section alt">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>See what you&apos;d save.</h2>
          <p className="m-sub m-center" style={{ maxWidth: 600, fontSize: 19 }}>
            Monthly cost for a club charging £35 per student, based on each provider&apos;s published pricing in October 2026.
          </p>
          <div className="m-table-wrap">
            <table className="m-table">
              <thead>
                <tr>
                  <th scope="col">Your club</th>
                  <th scope="col" className="us">Junbi</th>
                  <th scope="col">Martialytics</th>
                  <th scope="col">AllSorted</th>
                  <th scope="col">NEST (6 to 8%)</th>
                </tr>
              </thead>
              <tbody>
                {SAVINGS.map((r) => (
                  <tr key={r.club}>
                    <th scope="row">{r.club}</th>
                    <td className="us">{r.junbi}</td>
                    <td>{r.martialytics}</td>
                    <td>{r.allsorted}</td>
                    <td>{r.nest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <h2 className="m-h2 xl">Become a Founding Club.</h2>
        <p className="m-sub" style={{ maxWidth: 600 }}>50% off for six months, free migration, and your price locked for two years. Open to the first 100 clubs.</p>
        <div className="m-actions">
          <Link href="/signup?founding=1" className="m-btn on-dark">Claim your place</Link>
        </div>
      </section>
    </>
  );
}
