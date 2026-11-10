import { OG_SIZE, OG_TYPE } from "@/lib/og";
import { landingImage, landingImageParams } from "../../_landing/image";

export const alt = "Junbi: club management for UK taekwondo clubs";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const generateStaticParams = () => landingImageParams("compare");

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return landingImage("compare", (await params).slug);
}
