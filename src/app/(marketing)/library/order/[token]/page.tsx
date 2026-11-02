import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { libraryOrder } from "@/data/crm";
import { EBOOKS } from "@/lib/ebooks";
import { Cover } from "../../Cover";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const o = await libraryOrder((await params).token);
  if (!o) notFound();
  const more = EBOOKS.filter((b) => !o.items.some((i) => i.book.slug === b.slug));
  return (
    <div className="m-auth" style={{ maxWidth: 600 }}>
      <p className="m-eyebrow" style={{ textAlign: "left" }}>Order {o.number}</p>
      <h1>Thanks, {o.firstName}.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Your order is confirmed. We&apos;ve emailed a copy to {o.email}.</p>
      <div className="m-bag" style={{ marginTop: 28 }}>
        {o.items.map(({ book, downloadUrl }) => (
          <div key={book.slug} className="m-bag-item" style={{ cursor: "default" }}>
            <Cover book={book} size="xs" />
            <span className="t"><b>{book.title}</b><span>{downloadUrl ? `PDF, ${book.pages} pages` : "Coming soon. We'll email it the day it's out."}</span></span>
            {downloadUrl ? <a href={downloadUrl} className="m-btn primary" style={{ minHeight: 44 }}>Download</a> : <span className="m-fine">Pre-ordered</span>}
          </div>
        ))}
      </div>
      <div className="m-total" style={{ marginTop: 16 }}><span>Total paid</span><b>£0.00</b></div>
      {more.length > 0 && (
        <p style={{ margin: "32px 0 0", fontSize: 17 }}>Also free: {more.map((b, i) => <span key={b.slug}>{i ? ", " : ""}<Link href={`/library/${b.slug}`} className="m-link">{b.title}</Link></span>)}</p>
      )}
      <div className="m-card" style={{ marginTop: 40, padding: 24, borderRadius: 20 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 19 }}>Less admin. More training.</p>
        <p className="m-sub" style={{ textAlign: "left", fontSize: 16, margin: "6px 0 0", maxWidth: "none" }}>Junbi runs your students, registers, Direct Debit and messages for one flat price from £19 a month. Free for 7 days.</p>
        <p style={{ margin: "14px 0 0" }}><Link href="/signup" className="m-btn primary">Start free trial</Link></p>
      </div>
    </div>
  );
}
