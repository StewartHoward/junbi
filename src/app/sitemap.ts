import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { KIND_PATH, LANDINGS, landingPath } from "@/lib/landing";
import { shopEbooks } from "@/data/library";
import { SITE_URL } from "@/lib/seo";
import { publishedClubSites } from "@/data/website";
import { featureFlags } from "@/data/features";
import { LANDING_FEATURE } from "@/lib/feature-list";

// Club websites come and go, so build this on request (it's cached by the CDN for an hour).
export const revalidate = 3600;

/** Every public Junbi page, so search engines find them all. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const on = await featureFlags();
  const shown = (ref: string) => !LANDING_FEATURE[ref] || on[LANDING_FEATURE[ref]];
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/pricing", 0.9),
    ...Object.values(KIND_PATH).map((p) => page(p, 0.8)),
    ...LANDINGS.filter((l) => shown(`${l.kind}/${l.slug}`)).map((l) => page(landingPath(l), l.kind === "compare" ? 0.7 : 0.8)),
    page("/library", 0.8, "weekly"),
    ...(await shopEbooks()).map((b) => page(`/library/${b.slug}`, 0.7)),
    page("/guides", 0.8, "weekly"),
    ...GUIDES.map((g) => page(`/guides/${g.slug}`, 0.7)),
    page("/signup", 0.6),
    ...(on.family ? [page("/family", 0.3, "yearly")] : []),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    // Published clubs on a junbi.co.uk address. Clubs with their own domain have their own sitemap there.
    ...(on.website ? await publishedClubSites() : []).filter((c) => !c.customDomain).map((c) => page(`/c/${c.slug}`, 0.5, "weekly")),
  ];
}
