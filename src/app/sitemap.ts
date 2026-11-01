import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";

/** Every public Junbi page, so search engines find them all. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/pricing", 0.9),
    page("/founding-clubs", 0.8),
    page("/guides", 0.8, "weekly"),
    ...GUIDES.map((g) => page(`/guides/${g.slug}`, 0.7)),
    page("/signup", 0.6),
    page("/family", 0.3, "yearly"),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
  ];
}
