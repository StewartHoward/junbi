import type { Metadata } from "next";
import { orderDone } from "@/data/shop";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

/** Where Stripe sends families after paying for a shop order. */
export default async function ShopDone({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ session?: string }> }) {
  const [{ slug }, { session }] = await Promise.all([params, searchParams]);
  const r = await orderDone(slug, session);
  return (
    <div className="m-auth">
      {r && <p className="m-eyebrow">{r.clubName}</p>}
      <h1>{r?.paid ? "Thanks, that's paid." : "Nearly there."}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {r?.paid ? "We've emailed you a copy of your order. The club will hand it over at the club." : "We're waiting for the payment to go through. If you paid, you'll get an email in a minute."}
      </p>
    </div>
  );
}
