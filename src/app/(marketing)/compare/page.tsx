import { IndexPage, indexMetadata } from "../_landing/Landing";

export const metadata = indexMetadata("compare");

export default function Page() {
  return <IndexPage kind="compare" />;
}
