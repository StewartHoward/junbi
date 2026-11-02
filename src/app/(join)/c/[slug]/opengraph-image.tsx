import { requireFeature } from "@/data/features";
import { clubWebsite } from "@/data/website";
import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Martial arts club";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** A club website's share image, in the club's own colour. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await requireFeature("website");
  const w = await clubWebsite((await params).slug).catch(() => null);
  if (!w) return shareImage({ title: "Martial arts club" });
  const hero = w.sections.find((x) => x.type === "hero");
  const line = (hero && "text" in hero && hero.text) || w.tagline || (w.sites.length ? `Classes in ${w.sites.map((s) => s.name).join(", ")}` : undefined);
  return shareImage({ eyebrow: w.arts.join(" · ") || undefined, title: w.clubName, subtitle: line ?? undefined, colour: w.colour, footer: w.domain ?? `junbi.co.uk/c/${w.slug}` });
}
