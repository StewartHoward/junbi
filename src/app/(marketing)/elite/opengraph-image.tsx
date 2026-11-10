import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi Elite: your own club website, member app and payments, in your brand";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Junbi Elite", title: "Your club. Your brand. One system behind it all.", subtitle: "A custom website, your own member app, a coach portal and payments built in. Designed and set up for you." });
}
