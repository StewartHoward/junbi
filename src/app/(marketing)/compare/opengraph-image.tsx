import { OG_SIZE, OG_TYPE } from "@/lib/og";
import { INDEX } from "@/lib/landing";
import { landingImage } from "../_landing/image";

export const alt = INDEX.compare.share.title;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return landingImage("compare", "");
}
