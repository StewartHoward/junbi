import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Become a Founding Club on Junbi";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Founding Clubs", title: "Be one of Junbi's first 10 clubs.", subtitle: "50% off for six months, your move done for you, and your price locked for two years." });
}
