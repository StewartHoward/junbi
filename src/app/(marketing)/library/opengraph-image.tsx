import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";
import { shopEbooks } from "@/data/library";

export const alt = "The Junbi Library: ebooks for martial arts club owners";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const revalidate = 300;

export default async function Image() {
  const books = await shopEbooks();
  const allFree = books.length > 0 && books.every((b) => b.pricePence === 0);
  return shareImage({ eyebrow: "Junbi Library", title: allFree ? "Free ebooks for club owners." : "Ebooks for club owners.", subtitle: books.map((b) => b.title).join(", ") || "Practical books for martial arts clubs.", pill: allFree ? "Get them for £0" : "Junbi Library" });
}
