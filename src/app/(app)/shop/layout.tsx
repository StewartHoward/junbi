import { requireFeature } from "@/data/features";

/** Hidden until "shop" is switched on in the Junbi admin page. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFeature("shop");
  return children;
}
