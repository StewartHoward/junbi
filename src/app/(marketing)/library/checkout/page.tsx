import type { Metadata } from "next";
import { EBOOKS } from "@/lib/ebooks";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: true } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items } = await searchParams;
  const want = String(items ?? "").split(",").filter((s) => EBOOKS.some((b) => b.slug === s));
  return (
    <div className="m-auth" style={{ maxWidth: 560 }}>
      <p className="m-eyebrow" style={{ textAlign: "left" }}>Junbi Library</p>
      <h1>Checkout.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Nothing to pay. Just tell us where to send them.</p>
      <CheckoutForm books={EBOOKS} picked={want.length ? want : [EBOOKS[0].slug]} />
    </div>
  );
}
