import { clubWebsite } from "@/data/website";
import { shopPage } from "@/data/shop";
import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Club shop";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, w] = await Promise.all([shopPage(slug).catch(() => null), clubWebsite(slug).catch(() => null)]);
  return shareImage({ eyebrow: p?.clubName ?? "Club shop", title: "Club shop", subtitle: "Uniforms, kit and more.", colour: w?.colour, footer: p?.clubName ?? "junbi.co.uk" });
}
