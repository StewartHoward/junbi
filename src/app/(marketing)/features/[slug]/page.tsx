import { LandingPage, landingMetadata, landingParams } from "../../_landing/Landing";

export const dynamicParams = false;
export const generateStaticParams = () => landingParams("feature");
export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => landingMetadata("feature", params);

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LandingPage kind="feature" params={params} />;
}
