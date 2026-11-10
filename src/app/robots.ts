import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Search engines may read the public site and club websites, but not the app, families' links or private pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", "/admin", "/today", "/students", "/leads", "/classes", "/events", "/messages", "/payments", "/shop", "/website",
          "/settings", "/billing", "/setup", "/print/", "/join/", "/pay/", "/book/", "/family/", "/embed/", "/site/", "/invite", "/reset-password", "/forgot-password",
          "/library/checkout", "/library/order/", "/library/unsubscribe", "/downloads/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
