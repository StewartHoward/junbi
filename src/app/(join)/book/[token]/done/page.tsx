import type { Metadata } from "next";
import { bookingDone } from "@/data/events";

export const metadata: Metadata = { title: "Booked", robots: { index: false, follow: false } };

/** Where Stripe sends families after paying. */
export default async function BookDone({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ session?: string }> }) {
  const [{ token }, { session }] = await Promise.all([params, searchParams]);
  const page = await bookingDone(token, session);
  const paid = page?.people.filter((p) => p.status === "paid") ?? [];
  return (
    <div className="m-auth">
      {page && <p className="m-eyebrow">{page.clubName}</p>}
      <h1>{paid.length ? "You're booked." : "Nearly there."}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {paid.length
          ? `Thanks, that's paid. ${paid.map((p) => p.name.split(" ")[0]).join(" and ")} ${paid.length === 1 ? "is" : "are"} booked for ${page!.title}, ${page!.when}.`
          : "We're waiting for the payment to go through. If you paid, it'll show in a minute. If not, go back to your email link to try again."}
      </p>
    </div>
  );
}
