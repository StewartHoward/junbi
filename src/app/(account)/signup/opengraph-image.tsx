import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Start your free Junbi trial";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Free for 7 days", title: "Start your free trial.", subtitle: "Set up your club in an evening. Free for 7 days, no charge until day 8." });
}
