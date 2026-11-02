import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES } from "@/lib/guides";
import { INDEX, KIND_PATH, LANDINGS, landingBy, landingPath, landingRef, landingsOf, type Landing, type LandingKind } from "@/lib/landing";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";

/* Shared pieces for /features, /club-software and /compare. Each route file is a thin wrapper around these. */

const crumbName = (kind: LandingKind) => INDEX[kind].eyebrow;

function Paras({ body }: { body: string[] }) {
  const list = body.filter((p) => p.startsWith("- "));
  const paras = body.filter((p) => !p.startsWith("- "));
  return (
    <>
      {paras.map((p, i) => <p key={i} style={{ fontSize: 18, lineHeight: 1.6, margin: "14px 0 0" }}>{p}</p>)}
      {list.length > 0 && <ul style={{ fontSize: 18, lineHeight: 1.6, margin: "14px 0 0", paddingLeft: 22 }}>{list.map((p, i) => <li key={i} style={{ marginTop: 6 }}>{p.slice(2)}</li>)}</ul>}
    </>
  );
}

const cardStyle: React.CSSProperties = { display: "block", padding: 24, borderRadius: 20, textDecoration: "none", color: "inherit" };

function Cta() {
  return (
    <section className="m-section dark m-center">
      <h2 className="m-h2 xl">Ready when you are.</h2>
      <p className="m-sub" style={{ maxWidth: 600 }}>Every feature on every plan, from £19 a month. Free for 7 days, and 0% of your fees, ever.</p>
      <div className="m-actions">
        <Link href="/signup" className="m-btn on-dark">Start free trial</Link>
        <Link href="/pricing" className="m-link">See pricing</Link>
      </div>
    </section>
  );
}

/* ---------- One landing page ---------- */

export const landingParams = (kind: LandingKind) => landingsOf(kind).map((l) => ({ slug: l.slug }));

export async function landingMetadata(kind: LandingKind, params: Promise<{ slug: string }>): Promise<Metadata> {
  const l = landingBy(kind, (await params).slug);
  if (!l) return { title: "Not found" };
  return pageMeta({ ownImage: true, title: l.metaTitle, description: l.description, path: landingPath(l) });
}

export async function LandingPage({ kind, params }: { kind: LandingKind; params: Promise<{ slug: string }> }) {
  const l = landingBy(kind, (await params).slug);
  if (!l) notFound();
  const url = `${SITE_URL}${landingPath(l)}`;
  const related = l.related.map(landingRef).filter((x): x is Landing => Boolean(x));
  const guides = l.guides.map((s) => GUIDES.find((g) => g.slug === s)).filter((g): g is (typeof GUIDES)[number] => Boolean(g));
  const structured = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Junbi", item: SITE_URL }, { "@type": "ListItem", position: 2, name: crumbName(kind), item: `${SITE_URL}${KIND_PATH[kind]}` }, { "@type": "ListItem", position: 3, name: l.label, item: url }] },
    ...(l.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: l.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section m-center" style={{ paddingBottom: 56 }}>
        <p className="m-fine" style={{ margin: 0 }}><Link href={KIND_PATH[kind]} className="m-link">{crumbName(kind)}</Link></p>
        <p className="m-eyebrow" style={{ marginTop: 18 }}>{l.eyebrow}</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 68px)", maxWidth: 900 }}>{l.h1}</h1>
        <p className="m-sub" style={{ maxWidth: 680 }}>{l.intro}</p>
        <div className="m-actions">
          <Link href="/signup" className="m-btn primary">Start free trial</Link>
          <Link href="/pricing" className="m-link">See pricing</Link>
        </div>
        <p className="m-fine">Free for 7 days. One flat price, 0% of your fees.</p>
      </section>

      <section className="m-section alt">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {l.sections.map((s, i) => (
            <section key={s.heading} style={{ marginTop: i ? 48 : 0 }}>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 34px)", letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>{s.heading}</h2>
              <Paras body={s.body} />
            </section>
          ))}
        </div>
      </section>

      {l.table && (
        <section className="m-section">
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 className="m-h2 m-center" style={{ fontSize: "clamp(32px, 4.5vw, 44px)" }}>{l.table.caption}</h2>
            <div className="m-table-wrap">
              <table className={l.table.head.length <= 3 ? "m-table fit" : "m-table"}>
                <thead><tr>{l.table.head.map((h, i) => <th key={h} scope="col" className={i === 1 ? "us" : undefined}>{h}</th>)}</tr></thead>
                <tbody>
                  {l.table.rows.map((r) => (
                    <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i} className={i === 1 ? "us" : undefined}>{c}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-fine m-center" style={{ maxWidth: 720, margin: "20px auto 0", lineHeight: 1.5 }}>{l.table.note}</p>
          </div>
        </section>
      )}

      {l.faq.length > 0 && (
        <section className={l.table ? "m-section alt" : "m-section"}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <h2 className="m-h2 m-center" style={{ fontSize: "clamp(32px, 4.5vw, 44px)" }}>Questions.</h2>
            <div className="m-faq">
              {l.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {(related.length > 0 || guides.length > 0) && (
        <section className={l.table ? "m-section" : "m-section alt"}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {related.length > 0 && (
              <>
                <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>Keep reading</h2>
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 16 }}>
                  {related.map((r) => (
                    <Link key={landingPath(r)} href={landingPath(r)} className="m-card" style={cardStyle}>
                      <p className="m-fine" style={{ margin: 0 }}>{crumbName(r.kind)}</p>
                      <p style={{ margin: "6px 0 0", fontWeight: 600, fontSize: 19 }}>{r.label} ›</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
            {guides.length > 0 && (
              <>
                <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: related.length ? "40px 0 0" : 0 }}>Free guides</h2>
                <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none" }}>
                  {guides.map((g) => <li key={g.slug} style={{ marginTop: 10, fontSize: 18 }}><Link href={`/guides/${g.slug}`} className="m-link">{g.title}</Link></li>)}
                </ul>
              </>
            )}
          </div>
        </section>
      )}
      <Cta />
    </>
  );
}

/* ---------- Index pages ---------- */

export function indexMetadata(kind: LandingKind): Metadata {
  const x = INDEX[kind];
  return pageMeta({ ownImage: true, title: x.metaTitle, description: x.description, path: KIND_PATH[kind] });
}

export function IndexPage({ kind }: { kind: LandingKind }) {
  const x = INDEX[kind];
  const items = landingsOf(kind);
  const structured = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: items.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.label, url: `${SITE_URL}${landingPath(l)}` })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <section className="m-section m-center" style={{ paddingBottom: 32 }}>
        <p className="m-eyebrow">{x.eyebrow}</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(40px, 6vw, 64px)", maxWidth: 820 }}>{x.h1}</h1>
        <p className="m-sub" style={{ maxWidth: 620 }}>{x.intro}</p>
      </section>
      <section style={{ padding: "0 22px 120px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {items.map((l) => (
            <Link key={l.slug} href={landingPath(l)} className="m-card" style={{ ...cardStyle, padding: 28 }}>
              <h2 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em" }}>{l.label}</h2>
              <p className="m-sub" style={{ margin: "8px 0 0", fontSize: 16, textAlign: "left", maxWidth: "none" }}>{l.description}</p>
              <p className="m-fine" style={{ margin: "12px 0 0" }}>Read more ›</p>
            </Link>
          ))}
        </div>
      </section>
      <Cta />
    </>
  );
}

/** Landing pages that list this guide, so guides can link back to them. */
export const landingsForGuide = (slug: string) => LANDINGS.filter((l) => l.guides.includes(slug));
