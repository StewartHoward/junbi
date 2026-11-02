import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { libraryOrder } from "@/data/crm";
import { shopEbooks } from "@/data/library";
import { Cover } from "../../Cover";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ token }, { paid }] = await Promise.all([params, searchParams]);
  const o = await libraryOrder(token, typeof paid === "string" ? paid : undefined);
  if (!o) notFound();
  const more = (await shopEbooks()).filter((b) => !o.items.some((i) => i.book.slug === b.slug));
  const pending = o.status === "pending";
  return (
    <div className="m-auth" style={{ maxWidth: 600 }}>
      <p className="m-eyebrow" style={{ textAlign: "left" }}>Order {o.number}</p>
      <h1>{pending ? "Almost there." : `Thanks, ${o.firstName}.`}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {pending ? "We're waiting for your payment to come through. This page will update once it has. If you didn't finish paying, go back to the checkout." : `Your order is confirmed. We've emailed a copy to ${o.email}.`}
      </p>
      {pending && <p style={{ margin: "16px 0 0" }}><a href="" className="m-btn primary">Check again</a> <Link href={`/library/checkout?items=${o.items.map((i) => i.book.slug).join(",")}`} className="m-link" style={{ marginLeft: 12 }}>Back to checkout</Link></p>}
      <div className="m-bag" style={{ marginTop: 28 }}>
        {o.items.map(({ book, downloadUrl }) => (
          <div key={book.slug} className="m-bag-item" style={{ cursor: "default" }}>
            <Cover book={book} size="xs" />
            <span className="t"><b>{book.title}</b><span>{downloadUrl ? `PDF${book.pages ? `, ${book.pages} pages` : ""}` : pending ? "Ready to download once paid" : "Coming soon. We'll email it the day it's out."}</span></span>
            {downloadUrl ? <a href={downloadUrl} className="m-btn primary" style={{ minHeight: 44 }}>Download</a> : <span className="m-fine">{pending ? "Waiting" : "Pre-ordered"}</span>}
          </div>
        ))}
      </div>
      <div className="m-total" style={{ marginTop: 16 }}><span>{pending ? "To pay" : "Total paid"}</span><b>£{(o.amountPence / 100).toFixed(2)}</b></div>
      {more.length > 0 && (
        <p style={{ margin: "32px 0 0", fontSize: 17 }}>Also in the library: {more.map((b, i) => <span key={b.slug}>{i ? ", " : ""}<Link href={`/library/${b.slug}`} className="m-link">{b.title}</Link></span>)}</p>
      )}
      <div className="m-card" style={{ marginTop: 40, padding: 24, borderRadius: 20 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 19 }}>Less admin. More training.</p>
        <p className="m-sub" style={{ textAlign: "left", fontSize: 16, margin: "6px 0 0", maxWidth: "none" }}>Junbi runs your students, registers, Direct Debit and messages for one flat price from £19 a month. Free for 7 days.</p>
        <p style={{ margin: "14px 0 0" }}><Link href="/signup" className="m-btn primary">Start free trial</Link></p>
      </div>
    </div>
  );
}
