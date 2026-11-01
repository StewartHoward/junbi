import type { Metadata } from "next";
import type { clubWebsite } from "@/data/website";
import { SITE_URL } from "@/lib/seo";

type Site = NonNullable<Awaited<ReturnType<typeof clubWebsite>>>;

/** Where a club's site really lives: its own domain if it has one, otherwise junbi.co.uk/c/<slug>. */
export const clubHome = (w: Site) => (w.domain ? `https://${w.domain}` : `${SITE_URL}/c/${w.slug}`);

function lineFor(w: Site) {
  const hero = w.sections.find((x) => x.type === "hero");
  const tag = (hero && "text" in hero && hero.text) || w.tagline;
  const where = w.sites.map((s) => s.name).join(", ");
  const arts = w.arts.join(", ") || "Martial arts";
  const line = tag ? tag.trim() : `${arts} classes${where ? ` in ${where}` : ""}. Book a free trial.`;
  return /[.!?]$/.test(line) ? line : `${line}.`;
}

/** Title, description, canonical and share card for a club's website. */
export function clubMetadata(w: Site): Metadata {
  const where = w.sites.map((s) => s.name).join(", ");
  const title = `${w.clubName}${w.arts.length ? ` · ${w.arts.join(" & ")}` : ""}${where ? ` in ${where}` : ""}`;
  const description = `${lineFor(w)}${lineFor(w).includes("free trial") ? "" : " Book a free trial class online."}`.slice(0, 200);
  const url = clubHome(w);
  return {
    title: { absolute: title.length > 70 ? w.clubName : title },
    description,
    alternates: { canonical: url },
    openGraph: { title: w.clubName, description, url, siteName: w.clubName, type: "website", locale: "en_GB" },
    twitter: { card: "summary_large_image", title: w.clubName, description },
    ...(w.published ? {} : { robots: { index: false, follow: false } }),
  };
}

const heroImage = (w: Site) => {
  const hero = w.sections.find((x) => x.type === "hero");
  return hero && "image" in hero ? hero.image : null;
};

/** Structured data so the club can show up properly in local search: a sports club with its sites and contact details. */
export function clubStructuredData(w: Site) {
  const url = clubHome(w);
  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: w.clubName,
    url,
    description: lineFor(w),
    ...(heroImage(w) ? { image: `${SITE_URL}/img/${heroImage(w)}` } : {}),
    ...(w.phone ? { telephone: w.phone } : {}),
    ...(w.email ? { email: w.email } : {}),
    sport: w.arts,
    ...(w.sites.length
      ? {
          location: w.sites.map((s) => ({ "@type": "Place", name: s.name, ...(s.address ? { address: s.address.replace(/\n/g, ", ") } : {}) })),
        }
      : {}),
    ...(w.prices.length ? { makesOffer: w.prices.map((p) => ({ "@type": "Offer", name: p.name, description: p.price })) } : {}),
  };
}
