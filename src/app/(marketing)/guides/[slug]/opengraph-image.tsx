import { GUIDES, guideBySlug } from "@/lib/guides";
import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "A guide for martial arts club owners";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  return shareImage({ eyebrow: "Guide for club owners", title: g?.title ?? "Guides for club owners", subtitle: g ? `${g.minutes} minute read` : undefined });
}
