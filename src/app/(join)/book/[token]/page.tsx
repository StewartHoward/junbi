import type { Metadata } from "next";
import { bookingPage } from "@/data/events";
import { BookForm } from "./BookForm";

export const metadata: Metadata = { title: "Book", robots: { index: false, follow: false } };

/** From the club's invitation email: book (and pay for) a grading or event. */
export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await bookingPage(token);
  if (!page) {
    return (
      <div className="m-auth">
        <h1>This link isn&apos;t working.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>It may have been cancelled, or the date has passed. Ask the club if you&apos;re not sure.</p>
      </div>
    );
  }
  return (
    <div className="m-auth" style={{ maxWidth: 640 }}>
      <p className="m-eyebrow">{page.clubName}</p>
      <h1>{page.title}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {page.when}{page.location ? ` · ${page.location}` : ""}{page.feePence ? ` · £${(page.feePence / 100).toFixed(page.feePence % 100 ? 2 : 0)} each` : ""}
      </p>
      {page.notes && <p className="m-sub" style={{ fontSize: 16, marginTop: 12 }}>{page.notes}</p>}
      <BookForm token={token} page={page} />
    </div>
  );
}
