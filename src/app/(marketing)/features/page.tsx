import { IndexPage, indexMetadata } from "../_landing/Landing";

export const metadata = indexMetadata("feature");

export default function Page() {
  return <IndexPage kind="feature" />;
}
