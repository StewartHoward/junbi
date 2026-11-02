import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug, relatedGuides } from "@/lib/guides";
import { landingPath } from "@/lib/landing";
import { landingsForGuide } from "../../_landing/Landing";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return { title: "Guide" };
  const m = pageMeta({ ownImage: true, title: g.title, description: g.summary, path: `/guides/${g.slug}` });
  return { ...m, openGraph: { ...m.openGraph, type: "article" } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const others = relatedGuides(g);
  const pages = landingsForGuide(g.slug).slice(0, 4);
  const url = `${SITE_URL}/guides/${g.slug}`;
  const structured = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.summary, url, mainEntityOfPage: url, author: { "@type": "Organization", name: "Junbi", url: SITE_URL }, publisher: { "@type": "Organization", name: "Junbi", logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon` } }, inLanguage: "en-GB" },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Guides", item: `${SITE_URL}/guides` }, { "@type": "ListItem", position: 2, name: g.title, item: url }] },
  ];
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "72px 22px 96px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <p className="m-fine" style={{ margin: 0 }}><Link href="/guides" className="m-link">Guides</Link></p>
      <h1 style={{ fontSize: "clamp(34px, 5vw, 50px)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: "14px 0 0" }}>{g.title}</h1>
      <p className="m-sub" style={{ textAlign: "left", fontSize: 21, margin: "16px 0 0", maxWidth: "none" }}>{g.summary}</p>
      <p className="m-fine" style={{ margin: "12px 0 0" }}>{g.minutes} minute read</p>
      {g.sections.map((s) => {
        const list = s.body.filter((p) => p.startsWith("- "));
        const paras = s.body.filter((p) => !p.startsWith("- "));
        return (
          <section key={s.heading} style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>{s.heading}</h2>
            {paras.map((p, i) => <p key={i} style={{ fontSize: 18, lineHeight: 1.6, margin: "14px 0 0" }}>{p}</p>)}
            {list.length > 0 && <ul style={{ fontSize: 18, lineHeight: 1.6, margin: "14px 0 0", paddingLeft: 22 }}>{list.map((p, i) => <li key={i} style={{ marginTop: 6 }}>{p.slice(2)}</li>)}</ul>}
          </section>
        );
      })}
      <div className="m-card" style={{ marginTop: 56, padding: 28, borderRadius: 20 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>Junbi does the admin for you.</p>
        <p className="m-sub" style={{ textAlign: "left", fontSize: 17, margin: "8px 0 0", maxWidth: "none" }}>Students, Direct Debit, gradings, trials, a shop and your club website, from £19 a month. Free for 7 days.</p>
        <p style={{ margin: "16px 0 0" }}><Link href="/signup" className="m-btn primary">Start free trial</Link></p>
      </div>
      {pages.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>How Junbi helps</h2>
          <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {pages.map((p) => <li key={landingPath(p)} style={{ marginTop: 10 }}><Link href={landingPath(p)} className="m-link">{p.label}</Link></li>)}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Related guides</h2>
          <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none" }}>
            {others.map((o) => <li key={o.slug} style={{ marginTop: 10 }}><Link href={`/guides/${o.slug}`} className="m-link">{o.title}</Link></li>)}
          </ul>
        </section>
      )}
    </article>
  );
}
