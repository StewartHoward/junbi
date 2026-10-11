import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { billingWebhookSecret, handleBillingEvent } from "@/data/billing";

export const dynamic = "force-dynamic";

/** Junbi's own Stripe account: clubs' subscriptions and invoices for using Junbi. */
export async function POST(req: Request) {
  const payload = await req.text();
  const secret = await billingWebhookSecret();
  if (!secret || !verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; account?: string; data: { object: unknown } };
  if (event.account) return NextResponse.json({ ok: true, ignored: "connected account event" });
  try {
    await handleBillingEvent(event);
  } catch (err) {
    console.error("billing webhook failed", event.type, err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
