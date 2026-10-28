import type { Metadata } from "next";
import { payPage } from "@/data/paylink";
import { PayForm } from "./PayForm";

export const metadata: Metadata = { title: "Choose a membership", robots: { index: false, follow: false } };

/** From the "plan and payment" email a club sends: choose a membership and set up Direct Debit. */
export default async function PayPageView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await payPage(token);
  if (!page) {
    return (
      <div className="m-auth">
        <h1>This link has run out.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>It may be more than 14 days old, or everything is already set up. If you still need to pay, ask the club for a new link.</p>
      </div>
    );
  }
  return (
    <div className="m-auth" style={{ maxWidth: 640 }}>
      <p className="m-eyebrow">{page.clubName}</p>
      <h1>Finish joining.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Choose a membership, then set up your Direct Debit. Your place is confirmed once it&apos;s set up.</p>
      <PayForm token={token} page={page} />
    </div>
  );
}
