import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EBOOKS, ebookBySlug } from "@/lib/ebooks";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { Cover, Price } from "../Cover";

export const dynamicParams = false;
export const generateStaticParams = () => EBOOKS.map((b) => ({ slug: b.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = ebookBySlug((await params).slug);
  if (!b) return { title: "Not found" };
  return pageMeta({ ownImage: true, title: `${b.title}: Free Ebook`, description: `${b.subtitle}. ${b.pitch}`.slice(0, 158), path: `/library/${b.slug}` });
}

const FAQ = [
  { q: "Is it really free?", a: "Yes. The price is £0 and we never ask for a card. We ask a few questions about your club so we know who's reading, and that's it." },
  { q: "Will you send me emails?", a: "We email your order and the download link. Anything else only if you tick the box to say yes, and every email has an unsubscribe link." },
  { q: "Do I need to use Junbi?", a: "No. The books are for any martial arts club, whatever software you use, or none." },
];

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = ebookBySlug((await params).slug);
  if (!b) notFound();
  const others = EBOOKS.filter((x) => x.slug !== b.slug);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: b.title,
    description: b.subtitle,
    bookFormat: "https://schema.org/EBook",
    numberOfPages: b.pages,
    inLanguage: "en-GB",
    url: `${SITE_URL}/library/${b.slug}`,
    publisher: { "@type": "Organization", name: "Junbi", url: SITE_URL },
    offers: { "@type": "Offer", price: 0, priceCurrency: "GBP", availability: b.ready ? "https://schema.org/InStock" : "https://schema.org/PreOrder", url: `${SITE_URL}/library/${b.slug}` },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section" style={{ paddingTop: 64 }}>
        <p className="m-fine" style={{ maxWidth: 1020, margin: "0 auto 24px" }}><Link href="/library" className="m-link">Junbi Library</Link></p>
        <div className="m-product">
          <Cover book={b} size="lg" />
          <div>
            <p className="m-eyebrow" style={{ textAlign: "left" }}>Free ebook · PDF · {b.pages} pages</p>
            <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "10px 0 0" }}>{b.title}</h1>
            <p className="m-sub" style={{ textAlign: "left", margin: "14px 0 0", maxWidth: "none" }}>{b.subtitle}.</p>
            <div className="m-buy">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Price big />
                <Link href={`/library/checkout?items=${b.slug}`} className="m-btn primary">{b.ready ? "Get it for £0" : "Pre-order for £0"}</Link>
              </div>
              <p className="m-fine" style={{ margin: "12px 0 0", textAlign: "left" }}>{b.ready ? "Instant download. No card needed." : "Not quite finished. Order now and we'll email it to you the day it's out. No card needed."}</p>
            </div>
            <h2 style={{ fontSize: 24, margin: "40px 0 0", letterSpacing: "-0.02em" }}>What&apos;s inside</h2>
            <ul className="m-ticks">{b.contents.map((c) => <li key={c}>{c}</li>)}</ul>
            <h2 style={{ fontSize: 24, margin: "32px 0 0", letterSpacing: "-0.02em" }}>Who it&apos;s for</h2>
            <ul className="m-ticks">{b.forWho.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>
      </section>
      <section className="m-section alt">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Questions.</h2>
          <div className="m-faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>
      <section className="m-section">
        <h2 className="m-h2 m-center" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Also free in the library.</h2>
        <div className="m-shelf" style={{ marginTop: 32, maxWidth: 680 }}>
          {others.map((o) => (
            <Link key={o.slug} href={`/library/${o.slug}`} className="m-book-card" style={{ background: "#f5f5f7" }}>
              <Cover book={o} />
              <h3 style={{ margin: 0, fontSize: 20 }}>{o.title}</h3>
              <div className="row"><Price /><span className="m-link">See it</span></div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
