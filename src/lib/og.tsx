import { ImageResponse } from "next/og";

/*
 * Share images (1200 × 630) for links posted on Facebook, WhatsApp, LinkedIn, X and in messages.
 * Junbi pages: white, big black type, the blue pill. Club pages: the club's own colour.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

function onColour(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1d1d1f" : "#ffffff";
}

export function shareImage({ eyebrow, title, subtitle, colour, footer = "junbi.co.uk" }: { eyebrow?: string; title: string; subtitle?: string; colour?: string; footer?: string }) {
  const club = colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : null;
  const bg = club ?? "#ffffff";
  const ink = club ? onColour(club) : "#1d1d1f";
  const muted = club ? ink : "#6e6e73";
  const size = title.length > 60 ? 64 : title.length > 36 ? 80 : 96;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: bg, color: ink, padding: "72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow && <div style={{ fontSize: 32, fontWeight: 600, color: club ? ink : "#c8102e", opacity: club ? 0.85 : 1, marginBottom: 20 }}>{eyebrow}</div>}
          <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.03em", maxWidth: 1040 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 34, lineHeight: 1.35, color: muted, opacity: club ? 0.9 : 1, marginTop: 28, maxWidth: 980 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>{club ? footer : "junbi"}</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, padding: "14px 28px", borderRadius: 999, background: club ? ink : "#0066cc", color: club ? club : "#ffffff" }}>
            {club ? "Book a free trial" : "Free 7-day trial"}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
