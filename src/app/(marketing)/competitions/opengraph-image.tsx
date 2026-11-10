import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi Competitions: coming soon";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Junbi Competitions · Coming soon", title: "Competitions, ready.", subtitle: "Host a championship or enter your club in minutes. Every athlete in the right category. Free for every club to enter." });
}
