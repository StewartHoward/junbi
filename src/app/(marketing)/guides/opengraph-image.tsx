import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Guides for taekwondo club owners";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareImage({ eyebrow: "Guides", title: "Help for running a club.", subtitle: "Free, practical guides for taekwondo club owners: switching systems, gradings, trials and pricing." });
}
