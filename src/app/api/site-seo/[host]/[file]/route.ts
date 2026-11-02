import { clubWebsite, slugForDomain } from "@/data/website";

export const dynamic = "force-dynamic";

/*
 * robots.txt and sitemap.xml for a club on its own domain (the middleware rewrites them here).
 * Only published club sites are open to search engines.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ host: string; file: string }> }) {
  const { host, file } = await params;
  const slug = await slugForDomain(host);
  const site = slug ? await clubWebsite(slug) : null;
  const base = site?.domain ? `https://${site.domain}` : null;
  const headers = { "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" };

  if (file === "robots") {
    const body = base
      ? `User-Agent: *\nAllow: /\nDisallow: /join/\nDisallow: /pay/\nDisallow: /book/\nDisallow: /family/\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`
      : "User-Agent: *\nDisallow: /\n";
    return new Response(body, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (file === "sitemap" && base) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1</priority></url>\n</urlset>\n`;
    return new Response(body, { headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" } });
  }
  return new Response("Not found", { status: 404, headers });
}
