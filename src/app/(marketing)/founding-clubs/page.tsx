import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Founding Club",
  description: "Join the first 100 clubs on Junbi: 50% off for six months, free migration, and your price locked for two years.",
};

const PERKS = [
  { title: "A 30-day free trial", text: "Double the usual trial, so there's time to move your students and families across before you pay." },
  { title: "50% off for six months", text: "Once your trial ends, pay half price for your first six months." },
  { title: "Your move, done for you", text: "Send us your export from NEST, Martialytics, AllSorted or a spreadsheet. We bring your students and families across." },
  { title: "Price locked for two years", text: "Whatever happens to our prices, yours stays the same until 2028." },
];

export default function FoundingClubsPage() {
  return (
    <>
      <section className="m-section m-center" style={{ paddingTop: 96 }}>
        <p className="m-eyebrow">Founding Clubs</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 64px)" }}>Be one of the first 100.</h1>
        <p className="m-sub" style={{ maxWidth: 620 }}>
          The clubs that join first help shape Junbi. In return, they get the best deal we&apos;ll ever offer.
        </p>
        <div className="m-actions">
          <Link href="/signup?founding=1" className="m-btn primary">Claim my place</Link>
          <Link href="/pricing" className="m-link">See pricing</Link>
        </div>
      </section>
      <section className="m-section alt">
        <div className="m-tiles">
          {PERKS.map((p) => (
            <div key={p.title} className="m-tile">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
