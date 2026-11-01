import type { Metadata } from "next";

/** The public address of the site. Everything canonical and every share image points here. */
export const SITE_URL = (process.env.APP_URL || "https://junbi.co.uk").replace(/\/$/, "");

/**
 * Metadata for a public page: title, description, its one canonical address, and matching share-card text.
 * The share image itself comes from the nearest opengraph-image file.
 */
export function pageMeta({ title, description, path, absoluteTitle, noindex }: { title: string; description: string; path: string; absoluteTitle?: boolean; noindex?: boolean }): Metadata {
  const shareTitle = absoluteTitle ? title : `${title} · Junbi`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    // The default share image. Pages with their own opengraph-image file use that instead (files win).
    openGraph: { title: shareTitle, description, url: path, siteName: "Junbi", type: "website", locale: "en_GB", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Junbi: martial arts club management for UK clubs" }] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: ["/opengraph-image"] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** A JSON-LD block, with "<" escaped so text can't break out of the script tag. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
