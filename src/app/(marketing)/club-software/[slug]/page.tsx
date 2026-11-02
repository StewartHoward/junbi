import { LandingPage, landingMetadata, landingParams } from "../../_landing/Landing";

export const dynamicParams = false;
export const generateStaticParams = () => landingParams("art");
export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => landingMetadata("art", params);

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LandingPage kind="art" params={params} />;
}
