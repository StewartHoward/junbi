import { IndexPage, indexMetadata } from "../_landing/Landing";

export const metadata = indexMetadata("art");

export default function Page() {
  return <IndexPage kind="art" />;
}
