import Link from "next/link";
import type { Metadata } from "next";
import { FOUNDING_PLACES, foundingPlacesLeft } from "@/data/accounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a Founding Club",
  description: "Join the first 10 clubs on Junbi: 50% off for six months, free migration, and your price locked for two years.",
};

const PERKS = [
  { title: "50% off for six months", text: "Once your trial ends, pay half price for your first six months." },
  { title: "Your move, done for you", text: "Send us your export from your current system or a spreadsheet. We bring your students, families and belts across." },
  { title: "Price locked for two years", text: "Whatever happens to our prices, yours stays the same until 2028." },
];

export default async function FoundingClubsPage() {
  const left = await foundingPlacesLeft();
  return (
    <>
      <section className="m-section m-center" style={{ paddingTop: 96 }}>
        <p className="m-eyebrow">Founding Clubs</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 64px)" }}>Be one of the first {FOUNDING_PLACES}.</h1>
        <p className="m-sub" style={{ maxWidth: 620 }}>
          The clubs that join first help shape Junbi. In return, they get the best deal we&apos;ll ever offer.
        </p>
        <p className="m-fine" style={{ marginTop: 16 }}>
          {left > 0 ? `${left} of ${FOUNDING_PLACES} places left.` : `All ${FOUNDING_PLACES} places have gone. Thank you to our Founding Clubs.`}
        </p>
        <div className="m-actions">
          {left > 0 ? (
            <Link href="/signup?founding=1" className="m-btn primary">Claim my place</Link>
          ) : (
            <Link href="/signup" className="m-btn primary">Start free trial</Link>
          )}
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
