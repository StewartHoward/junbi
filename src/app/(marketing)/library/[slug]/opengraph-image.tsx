import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";
import { ebookBySlug, shopEbooks } from "@/data/library";
import { formatPrice } from "@/lib/ebooks";

export const alt = "An ebook from the Junbi Library";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 300;
export const generateStaticParams = async () => (await shopEbooks()).map((b) => ({ slug: b.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const b = await ebookBySlug((await params).slug);
  const price = b ? formatPrice(b.pricePence) : "£0";
  return shareImage({ eyebrow: b && b.pricePence === 0 ? "Free ebook · £0" : "Ebook", title: b?.title ?? "Junbi Library", subtitle: b?.pitch, colour: b?.cover.bg, footer: "junbi.co.uk/library", pill: `Get it for ${price}` });
}
