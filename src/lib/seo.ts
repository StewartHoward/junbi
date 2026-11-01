import type { Metadata } from "next";

/** The public address of the site. Everything canonical and every share image points here. */
export const SITE_URL = (process.env.APP_URL || "https://junbi.co.uk").replace(/\/$/, "");

/**
 * Metadata for a public page: title, description, its one canonical address, and matching share-card text.
 * The share image itself comes from the nearest opengraph-image file.
 */
// ownImage: the page folder has its own opengraph-image file, so don't set the default (it would override the file).
export function pageMeta({ title, description, path, absoluteTitle, noindex, ownImage }: { title: string; description: string; path: string; absoluteTitle?: boolean; noindex?: boolean; ownImage?: boolean }): Metadata {
  const def = ownImage ? {} : { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Junbi: martial arts club management for UK clubs" }] };
  const shareTitle = absoluteTitle ? title : `${title} · Junbi`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: shareTitle, description, url: path, siteName: "Junbi", type: "website", locale: "en_GB", ...def },
    twitter: { card: "summary_large_image", title: shareTitle, description, ...(ownImage ? {} : { images: ["/opengraph-image"] }) },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** A JSON-LD block, with "<" escaped so text can't break out of the script tag. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
