import { NextResponse } from "next/server";
import { stripeApi, verifyStripeSignature } from "@/lib/payments/stripe";
import { cancelMembership, clubForAccount, completeSetup, recordPayment, updateMandate } from "@/data/payments";

export const dynamic = "force-dynamic";

type Obj = Record<string, unknown> & { id: string };
type Event = { id: string; type: string; account?: string; data: { object: Obj } };

const day = (unix: unknown) => new Date((Number(unix) || Date.now() / 1000) * 1000).toISOString().slice(0, 10);
const mandateStatus = (s: unknown) => (s === "active" ? "active" : s === "inactive" ? "cancelled" : "pending_submission") as "active" | "cancelled" | "pending_submission";

/**
 * Stripe Connect webhook: events from clubs' own Stripe accounts.
 * Set up in Stripe as a Connect endpoint pointing at /api/payments/webhook/stripe.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(payload) as Event;
  if (!event.account) return NextResponse.json({ ok: true, ignored: "not a connected account event" });
  const clubId = await clubForAccount("stripe", event.account);
  if (!clubId) return NextResponse.json({ ok: true, ignored: "unknown account" });
  const o = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const meta = (o.metadata ?? {}) as Record<string, string>;
      const setupId = meta.junbi_setup_id;
      if (!setupId || !o.subscription) break;
      const sub = await stripeApi<{ items: { data: Array<{ id: string; price: { product: { metadata?: Record<string, string> } } }> } }>(
        "GET",
        `/subscriptions/${o.subscription}`,
        { expand: ["items.data.price.product"] },
        event.account,
      );
      await completeSetup(clubId, setupId, {
        customerId: String(o.customer ?? "") || null,
        mandateId: null,
        subscriptions: sub.items.data
          .map((i) => ({ studentId: i.price.product.metadata?.junbi_student_id ?? "", planId: i.price.product.metadata?.junbi_plan_id ?? "", subscriptionId: String(o.subscription) }))
          .filter((x) => x.studentId && x.planId),
      });
      break;
    }
    case "mandate.updated": {
      const pm = await stripeApi<{ customer: string | null }>("GET", `/payment_methods/${o.payment_method}`, null, event.account).catch(() => ({ customer: null }));
      await updateMandate(clubId, { mandateId: o.id, customerId: pm.customer }, mandateStatus(o.status), o.id);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const amount = Number(event.type === "invoice.paid" ? o.amount_paid : o.amount_due) || 0;
      if (!amount) break;
      await recordPayment(clubId, {
        providerPaymentId: o.id,
        customerId: String(o.customer ?? ""),
        amountPence: amount,
        chargeDate: day(o.created),
        status: event.type === "invoice.paid" ? "confirmed" : "failed",
        description: "Membership",
      });
      break;
    }
    case "customer.subscription.deleted":
      await cancelMembership(clubId, o.id);
      break;
  }
  return NextResponse.json({ ok: true });
}
