import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi: martial arts club management for UK clubs";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The default share image for every page that doesn't have its own. */
export default function Image() {
  return shareImage({ eyebrow: "Martial arts club management", title: "Your club, ready.", subtitle: "Classes, attendance, Direct Debit, gradings and messages to parents. One flat price, 0% of your fees." });
}
