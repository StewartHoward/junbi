import type { Metadata } from "next";
import { shopEbooks } from "@/data/library";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items } = await searchParams;
  const books = await shopEbooks();
  const want = String(items ?? "").split(",").filter((s) => books.some((b) => b.slug === s));
  return (
    <div className="m-auth" style={{ maxWidth: 560 }}>
      <p className="m-eyebrow" style={{ textAlign: "left" }}>Junbi Library</p>
      <h1>Checkout.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Tell us where to send your ebooks.</p>
      {books.length ? <CheckoutForm books={books} picked={want.length ? want : [books[0].slug]} /> : <p className="m-sub" style={{ marginTop: 24 }}>There's nothing in the library just yet.</p>}
    </div>
  );
}
