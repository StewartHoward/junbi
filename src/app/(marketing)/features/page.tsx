import { IndexPage, indexMetadata } from "../_landing/Landing";

// Re-checked every few minutes so feature switches on the admin page show here.
export const revalidate = 300;
export const metadata = indexMetadata("feature");

export default function Page() {
  return <IndexPage kind="feature" />;
}
