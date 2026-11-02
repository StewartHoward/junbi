import { LandingPage, landingMetadata, landingParams } from "../../_landing/Landing";

export const dynamicParams = false;
export const generateStaticParams = () => landingParams("compare");
export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => landingMetadata("compare", params);

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LandingPage kind="compare" params={params} />;
}
