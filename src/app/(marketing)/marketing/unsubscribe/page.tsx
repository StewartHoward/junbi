import type { Metadata } from "next";
import { UnsubscribeButton } from "./UnsubscribeButton";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** A button rather than unsubscribing on page load, so email link scanners can't unsubscribe people by accident. */
export default async function MarketingUnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="m-auth">
      <h1>Unsubscribe.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Stop emails from Junbi to your club. We won&apos;t contact you again.</p>
      <UnsubscribeButton token={String(t ?? "")} />
    </div>
  );
}
