import { NextResponse } from "next/server";
import { gcApi, verifyGoCardlessSignature } from "@/lib/payments/gocardless";
import { cancelMembership, clubForAccount, completeSetup, connectedAccount, loadSetup, recordPayment, updateMandate } from "@/data/payments";

export const dynamic = "force-dynamic";

type GcEvent = { id: string; resource_type: string; action: string; links: Record<string, string> };

const MANDATE: Record<string, "pending_submission" | "submitted" | "active" | "failed" | "cancelled" | "expired"> = {
  created: "pending_submission", submitted: "submitted", active: "active", reinstated: "active",
  failed: "failed", cancelled: "cancelled", expired: "expired",
};
const PAYMENT: Record<string, "pending" | "submitted" | "confirmed" | "paid_out" | "failed" | "charged_back" | "cancelled"> = {
  created: "pending", submitted: "submitted", confirmed: "confirmed", paid_out: "paid_out",
  failed: "failed", charged_back: "charged_back", cancelled: "cancelled", late_failure_settled: "failed",
};

/**
 * GoCardless partner webhook: events from clubs' own GoCardless accounts (links.organisation says whose).
 * Set up in GoCardless as the partner app's webhook pointing at /api/payments/webhook/gocardless.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyGoCardlessSignature(payload, req.headers.get("webhook-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 498 });
  const { events = [] } = JSON.parse(payload) as { events?: GcEvent[] };

  let failed = 0;
  for (const e of events) {
    try {
      await handle(e);
    } catch (err) {
      failed++;
      console.error("gocardless webhook event failed", e.id, e.resource_type, e.action, err);
    }
  }
  // Ask GoCardless to resend if anything failed; every step is safe to repeat.
  return failed ? NextResponse.json({ error: "Some events failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}

async function handle(e: GcEvent) {
  {
    const org = e.links.organisation;
    if (!org) return;
    const clubId = await clubForAccount("gocardless", org);
    if (!clubId) return;
    const account = await connectedAccount(clubId);
    const token = account?.accessToken;
    if (!token) return;

    if (e.resource_type === "billing_requests" && e.action === "fulfilled") {
      const br = await gcApi<{ billing_requests: { metadata?: Record<string, string>; links: { mandate_request_mandate?: string; customer?: string } } }>(token, "GET", `/billing_requests/${e.links.billing_request}`);
      const setupId = br.billing_requests.metadata?.junbi_setup_id;
      const mandate = br.billing_requests.links.mandate_request_mandate;
      if (!setupId || !mandate) return;
      const setup = await loadSetup(clubId, setupId);
      if (!setup || setup.status === "completed") return;
      const subscriptions = [];
      for (const item of setup.items) {
        if (!item.plan) continue;
        const sub = await gcApi<{ subscriptions: { id: string } }>(
          token,
          "POST",
          "/subscriptions",
          {
            subscriptions: {
              amount: item.plan.amountPence,
              currency: "GBP",
              interval_unit: item.plan.interval === "annual" ? "yearly" : "monthly",
              name: `${item.plan.name} (${item.firstName})`.slice(0, 255),
              metadata: { junbi_student_id: item.studentId },
              links: { mandate },
            },
          },
          `sub-${setupId}-${item.studentId}`,
        );
        subscriptions.push({ studentId: item.studentId, planId: item.planId, subscriptionId: sub.subscriptions.id });
      }
      // The sign-up fee goes as a one-off payment on the new mandate, collected alongside the first month.
      if (setup.signupFeePence > 0) {
        await gcApi(token, "POST", "/payments", { payments: { amount: setup.signupFeePence, currency: "GBP", description: "Sign-up fee", links: { mandate } } }, `fee-${setupId}`);
      }
      await completeSetup(clubId, setupId, { customerId: br.billing_requests.links.customer ?? null, mandateId: mandate, subscriptions });
    } else if (e.resource_type === "mandates" && MANDATE[e.action]) {
      await updateMandate(clubId, { mandateId: e.links.mandate }, MANDATE[e.action]);
    } else if (e.resource_type === "payments" && PAYMENT[e.action]) {
      const p = await gcApi<{ payments: { amount: number; charge_date: string; description?: string; links: { mandate: string } } }>(token, "GET", `/payments/${e.links.payment}`);
      await recordPayment(clubId, {
        providerPaymentId: e.links.payment,
        mandateId: p.payments.links.mandate,
        amountPence: p.payments.amount,
        chargeDate: p.payments.charge_date,
        status: PAYMENT[e.action],
        description: p.payments.description || "Membership",
      });
    } else if (e.resource_type === "subscriptions" && (e.action === "cancelled" || e.action === "finished")) {
      await cancelMembership(clubId, e.links.subscription);
    }
  }
}
