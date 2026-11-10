import Link from "next/link";
import type { Metadata } from "next";
import { shopEbooks } from "@/data/library";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { Cover, Price } from "./Cover";

// Ebooks are edited in HQ; saving there refreshes this straight away.
export const revalidate = 300;

export const metadata: Metadata = pageMeta({
  ownImage: true,
  title: "Ebooks for Taekwondo Club Owners",
  description: "The Junbi Library: practical ebooks on starting a taekwondo club, filling your classes and getting paid on time. Many are free.",
  path: "/library",
});

export default async function LibraryPage() {
  const books = await shopEbooks();
  const free = books.filter((b) => b.pricePence === 0);
  const structured = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: books.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/library/${b.slug}`, name: b.title })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section m-center" style={{ paddingBottom: 40 }}>
        <p className="m-eyebrow">Junbi Library</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 68px)", maxWidth: 860 }}>{free.length === books.length ? "Free ebooks for club owners." : "Ebooks for club owners."}</h1>
        <p className="m-sub" style={{ maxWidth: 640 }}>Practical, plain-English books on starting, filling and running a taekwondo club.{free.length ? ` ${free.length === books.length ? "Every one is" : `${free.length} of them are`} £0 at the checkout.` : ""}</p>
      </section>
      <section className="m-section alt" style={{ paddingTop: 56 }}>
        {books.length === 0 ? (
          <p className="m-sub m-center">New books are on the way. Check back soon.</p>
        ) : (
          <div className="m-shelf">
            {books.map((b) => (
              <Link key={b.slug} href={`/library/${b.slug}`} className="m-book-card">
                <Cover book={b} />
                <h2>{b.title}</h2>
                <p>{b.pitch}</p>
                <div className="row">
                  <Price book={b} />
                  <span className="m-link">{b.status === "preorder" ? "Pre-order" : b.pricePence ? "Buy" : "Get it"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="m-section m-center">
        <h2 className="m-h2" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Prefer something shorter?</h2>
        <p className="m-sub" style={{ maxWidth: 560 }}>Our guides cover the same ground in a few minutes each, with no checkout at all.</p>
        <p style={{ margin: "24px 0 0" }}><Link href="/guides" className="m-link">Read the guides</Link></p>
      </section>
    </>
  );
}
