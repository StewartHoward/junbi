import { shareImage } from "@/lib/og";
import { INDEX, landingBy, landingsOf, type LandingKind } from "@/lib/landing";

/** The share image for a landing page, or for the index page when slug is "". */
export function landingImage(kind: LandingKind, slug: string) {
  const s = landingBy(kind, slug)?.share ?? INDEX[kind].share;
  return shareImage({ eyebrow: s.eyebrow, title: s.title, subtitle: s.subtitle });
}

export const landingImageParams = (kind: LandingKind) => landingsOf(kind).map((l) => ({ slug: l.slug }));
