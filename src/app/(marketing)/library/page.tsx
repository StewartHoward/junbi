import Link from "next/link";
import type { Metadata } from "next";
import { EBOOKS } from "@/lib/ebooks";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { Cover, Price } from "./Cover";

export const metadata: Metadata = pageMeta({
  ownImage: true,
  title: "Free Ebooks for Martial Arts Club Owners",
  description: "The Junbi Library: free ebooks on starting a martial arts club, filling your classes and getting paid on time. £0 at the checkout.",
  path: "/library",
});

export default function LibraryPage() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: EBOOKS.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/library/${b.slug}`, name: b.title })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section m-center" style={{ paddingBottom: 40 }}>
        <p className="m-eyebrow">Junbi Library</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 68px)", maxWidth: 860 }}>Free ebooks for club owners.</h1>
        <p className="m-sub" style={{ maxWidth: 640 }}>Practical, plain-English books on starting, filling and running a martial arts club. Every one is £0 at the checkout. Take as many as you like.</p>
      </section>
      <section className="m-section alt" style={{ paddingTop: 56 }}>
        <div className="m-shelf">
          {EBOOKS.map((b) => (
            <Link key={b.slug} href={`/library/${b.slug}`} className="m-book-card">
              <Cover book={b} />
              <h2>{b.title}</h2>
              <p>{b.pitch}</p>
              <div className="row">
                <Price />
                <span className="m-link">{b.ready ? "Get it" : "Pre-order"}</span>
              </div>
            </Link>
          ))}
        </div>
        <p className="m-center" style={{ margin: "40px 0 0" }}>
          <Link href={`/library/checkout?items=${EBOOKS.map((b) => b.slug).join(",")}`} className="m-btn primary">Get all {EBOOKS.length} for £0</Link>
        </p>
      </section>
      <section className="m-section m-center">
        <h2 className="m-h2" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Prefer something shorter?</h2>
        <p className="m-sub" style={{ maxWidth: 560 }}>Our guides cover the same ground in a few minutes each, with no checkout at all.</p>
        <p style={{ margin: "24px 0 0" }}><Link href="/guides" className="m-link">Read the guides</Link></p>
      </section>
    </>
  );
}
