import { clubWebsite, slugForDomain } from "@/data/website";
import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Martial arts club";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** Share image for a club website on its own domain, in the club's colour. */
export default async function Image({ params }: { params: Promise<{ host: string }> }) {
  const slug = await slugForDomain((await params).host).catch(() => null);
  const w = slug ? await clubWebsite(slug).catch(() => null) : null;
  if (!w) return shareImage({ title: "Martial arts club" });
  const hero = w.sections.find((x) => x.type === "hero");
  const line = (hero && "text" in hero && hero.text) || w.tagline || undefined;
  return shareImage({ eyebrow: w.arts.join(" · ") || undefined, title: w.clubName, subtitle: line, colour: w.colour, footer: w.domain ?? w.clubName });
}
