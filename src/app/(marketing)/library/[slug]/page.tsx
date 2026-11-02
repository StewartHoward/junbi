import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ebookBySlug, shopEbooks } from "@/data/library";
import { formatPrice } from "@/lib/ebooks";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { Cover, Price } from "../Cover";

export const revalidate = 300;
export const generateStaticParams = async () => (await shopEbooks()).map((b) => ({ slug: b.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await ebookBySlug((await params).slug);
  if (!b) return { title: "Not found" };
  return pageMeta({ ownImage: true, title: `${b.title}: ${b.pricePence ? "Ebook" : "Free Ebook"}`, description: `${b.subtitle}. ${b.pitch}`.slice(0, 158), path: `/library/${b.slug}` });
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await ebookBySlug((await params).slug);
  if (!b) notFound();
  const others = (await shopEbooks()).filter((x) => x.slug !== b.slug);
  const free = b.pricePence === 0;
  const faq = [
    free
      ? { q: "Is it really free?", a: "Yes. The price is £0 and we never ask for a card. We ask a few questions about your club so we know who's reading, and that's it." }
      : { q: "How do I pay?", a: `By card, securely through Stripe. It's ${formatPrice(b.pricePence)}, once, with nothing more to pay.` },
    { q: "Will you send me emails?", a: "We email your order and the download link. Anything else only if you tick the box to say yes, and every email has an unsubscribe link." },
    { q: "Do I need to use Junbi?", a: "No. The books are for any martial arts club, whatever software you use, or none." },
  ];
  const structured = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: b.title,
    description: b.subtitle,
    bookFormat: "https://schema.org/EBook",
    ...(b.pages ? { numberOfPages: b.pages } : {}),
    inLanguage: "en-GB",
    url: `${SITE_URL}/library/${b.slug}`,
    publisher: { "@type": "Organization", name: "Junbi", url: SITE_URL },
    offers: { "@type": "Offer", price: (b.pricePence / 100).toFixed(2), priceCurrency: "GBP", availability: b.ready ? "https://schema.org/InStock" : "https://schema.org/PreOrder", url: `${SITE_URL}/library/${b.slug}` },
  };
  const action = b.status === "preorder" ? `Pre-order for ${formatPrice(b.pricePence)}` : free ? "Get it for £0" : `Buy for ${formatPrice(b.pricePence)}`;
  const note = b.status === "preorder" ? `Not quite finished. Order now and we'll email it to you the day it's out.${free ? " No card needed." : ""}` : free ? "Instant download. No card needed." : "Instant download after payment. Pay securely by card.";
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section" style={{ paddingTop: 64 }}>
        <p className="m-fine" style={{ maxWidth: 1020, margin: "0 auto 24px" }}><Link href="/library" className="m-link">Junbi Library</Link></p>
        <div className="m-product">
          <Cover book={b} size="lg" />
          <div>
            <p className="m-eyebrow" style={{ textAlign: "left" }}>{free ? "Free ebook" : "Ebook"} · PDF{b.pages ? ` · ${b.pages} pages` : ""}</p>
            <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "10px 0 0" }}>{b.title}</h1>
            {b.subtitle && <p className="m-sub" style={{ textAlign: "left", margin: "14px 0 0", maxWidth: "none" }}>{b.subtitle}.</p>}
            <div className="m-buy">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Price book={b} big />
                <Link href={`/library/checkout?items=${b.slug}`} className="m-btn primary">{action}</Link>
              </div>
              <p className="m-fine" style={{ margin: "12px 0 0", textAlign: "left" }}>{note}</p>
            </div>
            {b.description && b.description.split(/\n\s*\n/).map((para, i) => <p key={i} style={{ fontSize: 18, lineHeight: 1.6, margin: i ? "14px 0 0" : "32px 0 0" }}>{para}</p>)}
            {b.contents.length > 0 && <><h2 style={{ fontSize: 24, margin: "40px 0 0", letterSpacing: "-0.02em" }}>What&apos;s inside</h2><ul className="m-ticks">{b.contents.map((c) => <li key={c}>{c}</li>)}</ul></>}
            {b.forWho.length > 0 && <><h2 style={{ fontSize: 24, margin: "32px 0 0", letterSpacing: "-0.02em" }}>Who it&apos;s for</h2><ul className="m-ticks">{b.forWho.map((c) => <li key={c}>{c}</li>)}</ul></>}
          </div>
        </div>
      </section>
      <section className="m-section alt">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Questions.</h2>
          <div className="m-faq">{faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>
      {others.length > 0 && (
        <section className="m-section">
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(30px, 4vw, 40px)" }}>Also in the library.</h2>
          <div className="m-shelf" style={{ marginTop: 32, maxWidth: 680 }}>
            {others.map((o) => (
              <Link key={o.slug} href={`/library/${o.slug}`} className="m-book-card" style={{ background: "#f5f5f7" }}>
                <Cover book={o} />
                <h3 style={{ margin: 0, fontSize: 20 }}>{o.title}</h3>
                <div className="row"><Price book={o} /><span className="m-link">See it</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
