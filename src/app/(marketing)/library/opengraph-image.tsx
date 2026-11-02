import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";
import { EBOOKS } from "@/lib/ebooks";

export const alt = "The Junbi Library: free ebooks for martial arts club owners";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Junbi Library", title: "Free ebooks for club owners.", subtitle: `${EBOOKS.map((b) => b.title).join(", ")}. All £0.`, pill: "Get them for £0" });
}
