import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi: club management for UK taekwondo clubs";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The default share image for every page that doesn't have its own. */
export default function Image() {
  return shareImage({ eyebrow: "Taekwondo club management", title: "Your club, ready.", subtitle: "Kup and dan grades, gradings, registers and Direct Debit. One flat price, 0% of your fees." });
}
