import { LandingPage, landingMetadata, landingParams } from "../../_landing/Landing";

// Re-checked every few minutes so feature switches on the admin page show here.
export const revalidate = 300;
export const dynamicParams = false;
export const generateStaticParams = () => landingParams("art");
export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) => landingMetadata("art", params);

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <LandingPage kind="art" params={params} />;
}
