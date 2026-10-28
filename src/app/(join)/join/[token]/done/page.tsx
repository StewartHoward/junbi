import type { Metadata } from "next";
import { joinSetupStatus } from "@/data/join";

export const metadata: Metadata = { title: "Thanks", robots: { index: false, follow: false } };

/** Where Stripe or GoCardless send parents back to. */
export default async function JoinDone({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ setup?: string; cancelled?: string }> }) {
  const [{ token }, { setup, cancelled }] = await Promise.all([params, searchParams]);
  const st = setup ? await joinSetupStatus(token, setup) : null;
  if (cancelled || !st) {
    return (
      <div className="m-auth">
        <h1>Almost there.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>
          Your Direct Debit isn&apos;t set up yet, so your place isn&apos;t confirmed. Go back to finish it, or the club can email you a link.
        </p>
      </div>
    );
  }
  return (
    <div className="m-auth">
      <p className="m-eyebrow">{st.clubName}</p>
      <h1>You&apos;re all set.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        Thanks for setting up your Direct Debit. {st.provider === "stripe" ? "Stripe" : "GoCardless"} will email you to confirm it, and the first payment comes out in the next few days. The club will be in touch about classes.
      </p>
    </div>
  );
}
