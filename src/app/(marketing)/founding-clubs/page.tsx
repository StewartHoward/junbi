import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Become a Founding Club",
  description: "Join the first 100 clubs on Junbi: 50% off for six months, free migration, and your price locked for two years.",
};

export default async function FoundingClubsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <section className="m-section m-center" style={{ paddingTop: 96 }}>
      <p className="m-eyebrow">Founding Clubs</p>
      <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 64px)" }}>Be one of the first 100.</h1>
      <p className="m-sub" style={{ maxWidth: 620 }}>
        50% off for six months, your whole move from your current system done for you, and your price locked for two years.
      </p>
      <SignupForm plan={plan} />
    </section>
  );
}
