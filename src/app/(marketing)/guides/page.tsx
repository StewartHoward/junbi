import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = pageMeta({
  title: "Guides for club owners",
  description: "Free, practical guides for martial arts club owners: switching club software, running gradings, turning trials into members and setting prices.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <>
      <section className="m-section m-center" style={{ paddingBottom: 32 }}>
        <p className="m-eyebrow">Guides</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 64px)", maxWidth: 820 }}>Help for running a club.</h1>
        <p className="m-sub" style={{ maxWidth: 620 }}>Short, practical guides from people who run martial arts clubs. Free for everyone to read, whether you use Junbi or not. No sign-up needed.</p>
      </section>
      <section style={{ padding: "0 22px 120px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 16 }}>
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="m-card" style={{ display: "block", padding: 28, borderRadius: 20, textDecoration: "none", color: "inherit" }}>
              <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>{g.title}</h2>
              <p className="m-sub" style={{ margin: "8px 0 0", fontSize: 17, textAlign: "left", maxWidth: "none" }}>{g.summary}</p>
              <p className="m-fine" style={{ margin: "12px 0 0" }}>{g.minutes} minute read ›</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
