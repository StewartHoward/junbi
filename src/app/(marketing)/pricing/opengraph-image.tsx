import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi pricing: from £19 a month, every feature on every plan";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Pricing", title: "From £19 a month. Your fees stay yours.", subtitle: "One flat price for your club. Every feature on every plan, and no percentage of your memberships, ever." });
}
