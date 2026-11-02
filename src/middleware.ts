import { NextResponse, type NextRequest } from "next/server";

/*
 * Clubs can point their own domain at Junbi. Requests for those domains show the club's website: the home
 * page and the shop are rewritten to /site/<host>, which looks the club up. Everything else (assets, photos,
 * sign-up links) is served as normal. robots.txt and sitemap.xml are the club's own.
 */
const OURS = /^(junbi\.co\.uk|www\.junbi\.co\.uk|localhost|127\.0\.0\.1|.*\.netlify\.app|.*\.localhost)$/i;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host || OURS.test(host)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  // The club's own robots.txt and sitemap, pointing at its domain rather than junbi.co.uk.
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    const url = req.nextUrl.clone();
    url.pathname = `/api/site-seo/${host}/${pathname === "/robots.txt" ? "robots" : "sitemap"}`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/" || pathname === "/shop" || pathname === "/shop/done") {
    const url = req.nextUrl.clone();
    url.pathname = `/site/${host}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/shop", "/shop/done", "/robots.txt", "/sitemap.xml"] };
