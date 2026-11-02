import { requireFeature } from "@/data/features";

/** Hidden until "family" is switched on in the Junbi admin page. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature("family");
  return children;
}
