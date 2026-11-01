import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Parent and member login";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Parents and members", title: "Your classes, belts and bookings.", subtitle: "Sign in with your email. No password to remember." });
}
