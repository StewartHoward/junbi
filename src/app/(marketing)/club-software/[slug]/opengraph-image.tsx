import { OG_SIZE, OG_TYPE } from "@/lib/og";
import { landingImage, landingImageParams } from "../../_landing/image";

export const alt = "Junbi: martial arts club management for UK clubs";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const generateStaticParams = () => landingImageParams("art");

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return landingImage("art", (await params).slug);
}
