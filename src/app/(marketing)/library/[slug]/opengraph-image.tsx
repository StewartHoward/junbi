import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";
import { EBOOKS, ebookBySlug } from "@/lib/ebooks";

export const alt = "A free ebook from the Junbi Library";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const generateStaticParams = () => EBOOKS.map((b) => ({ slug: b.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const b = ebookBySlug((await params).slug);
  return shareImage({ eyebrow: "Free ebook · £0", title: b?.title ?? "Junbi Library", subtitle: b?.pitch, colour: b?.cover.bg, footer: "junbi.co.uk/library", pill: "Get it for £0" });
}
