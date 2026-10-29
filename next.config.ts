import type { NextConfig } from "next";

/** Browser security settings sent with every page. */
const securityHeaders = [
  // Always use HTTPS (two years), including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Junbi can't be shown inside another site's frame (stops click-jacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only see "junbi.co.uk" when someone follows a link, never the full address (sign-up links carry a secret).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

/**
 * The timetable clubs show on their own websites (/embed/...) is the one thing allowed inside another
 * site's frame. It's read-only and has no sign-in, so click-jacking isn't a risk there.
 */
const embedHeaders = securityHeaders
  .filter((h) => h.key !== "X-Frame-Options")
  .map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors *") } : h));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!embed/).*)", headers: securityHeaders },
      { source: "/embed/:path*", headers: embedHeaders },
      // The script clubs paste into their sites: cache it for an hour so it's quick, but changes still reach everyone.
      { source: "/embed.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
    ];
  },
  // Student import posts a whole spreadsheet to a server action.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
