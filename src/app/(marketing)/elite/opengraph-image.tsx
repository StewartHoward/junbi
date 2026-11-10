import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Junbi Elite: a club system custom built for you";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Junbi Elite", title: "Your club's own system. Built just for you.", subtitle: "A website, member app, coach portal and payments, custom built for your club around the way you run it." });
}
