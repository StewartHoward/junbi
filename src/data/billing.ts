import "server-only";
import { cache } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { stripeApi } from "@/lib/payments/stripe";
import { decrypt, encrypt } from "@/lib/payments/crypto";
import { clubFeeNow, planName, PLANS } from "@/lib/plans";
import { todayISO } from "./classes";

/*
 * Junbi charging clubs. Each club gets a monthly subscription on Junbi's own Stripe account
 * (not the club's). The card goes in at sign-up; nothing is taken until the 7-day trial ends.
 */

/** Subscription states where the club is set up and can carry on using Junbi. */
const OK_STATUSES = new Set(["trialing", "active", "past_due"]);

export const billingOn = () => Boolean(process.env.STRIPE_SECRET_KEY);

type ClubBillingRow = {
  plan: string;
  founding: boolean;
  trialEndsOn: string | null;
  discountPercent: number | null;
  discountMonths: number | null;
  billingStatus: string | null;
};

/** Free for good (a 100% code with no end date) never needs a card. */
export const isFreeForGood = (c: Pick<ClubBillingRow, "discountPercent" | "discountMonths">) => (c.discountPercent ?? 0) >= 100 && c.discountMonths == null;

/** True when the club still has to add a card before carrying on. */
export function needsCard(c: ClubBillingRow) {
  if (isFreeForGood(c)) return false;
  return !OK_STATUSES.has(c.billingStatus ?? "");
}

async function clubRow(clubId: string, userId?: string) {
  return withClub({ clubId, userId }, async (tx) => {
    const [c] = await tx.select().from(s.clubs).where(eq(s.clubs.id, clubId));
    return c;
  });
}

/** For the app layout: does this owner need sending to /billing first? Cached per request. */
export const billingGate = cache(async (actor: Actor) => {
  if (!billingOn() || actor.role !== "owner") return false;
  const c = await clubRow(actor.clubId, actor.userId);
  return c ? needsCard(c) : false;
});

/** What the billing page shows. */
export async function clubBilling(actor: Actor) {
  assertCan(actor, "club.manage");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [c] = await tx.select().from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const invoices = await tx.select().from(s.junbiInvoices).orderBy(desc(s.junbiInvoices.createdAt)).limit(24);
    const fee = clubFeeNow({ plan: c.plan, founding: c.founding, trialEndsOn: c.trialEndsOn, discountPercent: c.discountPercent, discountMonths: c.discountMonths }, todayISO());
    return {
      plan: c.plan,
      planName: planName(c.plan),
      listPence: PLANS.find((p) => p.id === c.plan)?.monthlyPence ?? 0,
      founding: c.founding,
      promoCode: c.promoCode,
      discountPercent: c.discountPercent,
      discountMonths: c.discountMonths,
      trialEndsOn: c.trialEndsOn,
      status: c.billingStatus,
      periodEnd: c.billingPeriodEnd,
      hasCustomer: Boolean(c.billingCustomerId),
      needsCard: needsCard(c),
      freeForGood: isFreeForGood(c),
      fee,
      invoices: invoices.filter((i) => i.amountPence > 0),
    };
  });
}

/* ---------- Discounts as Stripe coupons ---------- */

async function ensureCoupon(percent: number, months: number | null): Promise<string> {
  const id = `junbi-${percent}-${months ? `${months}m` : "forever"}`;
  try {
    await stripeApi("GET", `/coupons/${id}`, null);
  } catch {
    await stripeApi("POST", "/coupons", {
      id,
      percent_off: percent,
      duration: months ? "repeating" : "forever",
      ...(months ? { duration_in_months: months } : {}),
      name: months ? `${percent}% off for ${months} months` : `${percent}% off`,
    });
  }
  return id;
}

/** Founding Clubs: 50% off for six months. A code: its % for its months. The bigger one wins. */
async function couponFor(c: ClubBillingRow): Promise<string | null> {
  const code = c.discountPercent ? { pct: c.discountPercent, months: c.discountMonths } : null;
  const founding = c.founding ? { pct: 50, months: 6 } : null;
  const best = [code, founding].filter(Boolean).sort((a, b) => b!.pct - a!.pct)[0];
  if (!best || best.pct <= 0) return null;
  return ensureCoupon(Math.min(best.pct, 100), best.months);
}

const priceData = (plan: string) => ({
  currency: "gbp",
  unit_amount: PLANS.find((p) => p.id === plan)?.monthlyPence ?? PLANS[0].monthlyPence,
  recurring: { interval: "month" },
  product_data: { name: `Junbi ${planName(plan)} plan` },
});

/**
 * Stripe Checkout to add the club's card. With trial days left, nothing is taken until the trial ends
 * (Stripe needs the trial end at least 48 hours away, so a trial ending sooner is stretched to that).
 */
export async function startBillingCheckout(actor: Actor & { clubName?: string }, base: string, email: string): Promise<string> {
  assertCan(actor, "club.manage");
  const c = await clubRow(actor.clubId, actor.userId);
  if (!c) throw new Error("Club not found");
  const nowSec = Math.floor(Date.now() / 1000);
  const trialEnd = c.trialEndsOn ? Math.floor(Date.parse(`${c.trialEndsOn}T23:00:00Z`) / 1000) : 0;
  const trial = trialEnd > nowSec ? Math.max(trialEnd, nowSec + 48 * 3600 + 300) : 0;
  const coupon = await couponFor(c);
  const session = await stripeApi<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    ...(c.billingCustomerId ? { customer: c.billingCustomerId } : { customer_email: email }),
    client_reference_id: c.id,
    metadata: { club_id: c.id },
    line_items: [{ price_data: priceData(c.plan), quantity: 1 }],
    subscription_data: { metadata: { club_id: c.id, club_name: c.name }, ...(trial ? { trial_end: trial } : {}) },
    ...(coupon ? { discounts: [{ coupon }] } : {}),
    payment_method_collection: "always",
    success_url: `${base}/billing/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/billing`,
  }, undefined, `checkout-${c.id}-${nowSec >> 6}`);
  return session.url;
}

/** Straight after sign-up: the Checkout link, or null when billing is off or the club is free. */
export async function checkoutAfterSignup(ids: { userId: string; clubId: string }, email: string, base: string): Promise<string | null> {
  if (!billingOn()) return null;
  const c = await clubRow(ids.clubId, ids.userId);
  if (!c || !needsCard(c)) return null;
  return startBillingCheckout({ userId: ids.userId, clubId: ids.clubId, role: "owner", sites: "all" }, base, email);
}

type Sub = { id: string; status: string; customer: string; current_period_end?: number; metadata?: { club_id?: string }; items?: { data: Array<{ id: string }> } };

async function saveSubscription(clubId: string, sub: Sub) {
  await withClub({ clubId }, (tx) =>
    tx.update(s.clubs).set({
      billingCustomerId: sub.customer,
      billingSubscriptionId: sub.id,
      billingStatus: sub.status,
      billingPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    }).where(eq(s.clubs.id, clubId)),
  );
}

/** Back from Checkout: save the subscription straight away rather than waiting for the webhook. */
export async function finishBillingCheckout(actor: Actor, sessionId: string): Promise<boolean> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  const session = await stripeApi<{ metadata?: { club_id?: string }; subscription?: Sub | string | null }>("GET", `/checkout/sessions/${sessionId}`, { expand: ["subscription"] });
  if (session.metadata?.club_id !== actor.clubId || !session.subscription || typeof session.subscription === "string") return false;
  await saveSubscription(actor.clubId, session.subscription);
  return true;
}

/* ---------- Platform settings (webhook secret, portal configuration) ---------- */

async function getSetting(key: string): Promise<string | null> {
  const [r] = await db().select().from(s.platformSettings).where(eq(s.platformSettings.key, key));
  return r?.value ?? null;
}
async function setSetting(key: string, value: string) {
  await db().insert(s.platformSettings).values({ key, value }).onConflictDoUpdate({ target: s.platformSettings.key, set: { value, updatedAt: new Date() } });
}

/** Stripe's page where a club updates its card, sees invoices or cancels. */
export async function billingPortal(actor: Actor, base: string): Promise<string> {
  assertCan(actor, "club.manage");
  const c = await clubRow(actor.clubId, actor.userId);
  if (!c?.billingCustomerId) throw new Error("No billing set up yet.");
  let config = await getSetting("billing_portal_config");
  if (!config) {
    const made = await stripeApi<{ id: string }>("POST", "/billing_portal/configurations", {
      business_profile: { headline: "Junbi billing", privacy_policy_url: `${base}/privacy`, terms_of_service_url: `${base}/terms` },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
      },
    });
    config = made.id;
    await setSetting("billing_portal_config", config);
  }
  const p = await stripeApi<{ url: string }>("POST", "/billing_portal/sessions", { customer: c.billingCustomerId, configuration: config, return_url: `${base}/billing` });
  return p.url;
}

/** When a club changes plan, its subscription moves to the new price from the next bill. */
export async function syncBillingPlan(clubId: string, plan: string) {
  if (!billingOn()) return;
  const c = await clubRow(clubId);
  if (!c?.billingSubscriptionId || !OK_STATUSES.has(c.billingStatus ?? "")) return;
  const sub = await stripeApi<Sub>("GET", `/subscriptions/${c.billingSubscriptionId}`, null);
  const item = sub.items?.data[0];
  if (!item) return;
  // A subscription item's price_data needs a product id, so keep one Stripe product per plan.
  let product = await getSetting(`billing_product_${plan}`);
  if (!product) {
    product = (await stripeApi<{ id: string }>("POST", "/products", { name: `Junbi ${planName(plan)} plan` })).id;
    await setSetting(`billing_product_${plan}`, product);
  }
  const { product_data: _unused, ...price } = priceData(plan);
  void _unused;
  await stripeApi("POST", `/subscriptions/${sub.id}`, { items: [{ id: item.id, price_data: { ...price, product } }], proration_behavior: "none" });
}

/* ---------- Webhook ---------- */

export const BILLING_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
];

/** Creates Junbi's billing webhook on Junbi's Stripe account (once) and keeps its secret, encrypted. */
export async function ensureBillingWebhook(base: string): Promise<{ created: boolean }> {
  const existing = await getSetting("billing_webhook");
  if (existing) return { created: false };
  const url = `${base}/api/billing/webhook`;
  // An earlier attempt may have made an endpoint whose secret was never saved: remove it first.
  const list = await stripeApi<{ data: Array<{ id: string; url: string }> }>("GET", "/webhook_endpoints", { limit: 100 });
  for (const w of list.data.filter((w) => w.url === url)) await stripeApi("DELETE", `/webhook_endpoints/${w.id}`, null);
  const wh = await stripeApi<{ id: string; secret: string }>("POST", "/webhook_endpoints", {
    url,
    enabled_events: BILLING_EVENTS,
    description: "Junbi billing (clubs paying Junbi)",
  });
  try {
    await setSetting("billing_webhook", encrypt(JSON.stringify({ id: wh.id, secret: wh.secret })));
  } catch (err) {
    await stripeApi("DELETE", `/webhook_endpoints/${wh.id}`, null).catch(() => {});
    const cause = (err as { cause?: { message?: string } }).cause?.message;
    throw new Error(`Couldn't save the billing setting${cause ? `: ${cause}` : ""}`);
  }
  return { created: true };
}

export async function billingWebhookReady() {
  return Boolean(process.env.STRIPE_BILLING_WEBHOOK_SECRET || (await getSetting("billing_webhook")));
}

export async function billingWebhookSecret(): Promise<string> {
  if (process.env.STRIPE_BILLING_WEBHOOK_SECRET) return process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const v = await getSetting("billing_webhook");
  if (!v) return "";
  try {
    return (JSON.parse(decrypt(v)) as { secret: string }).secret;
  } catch {
    return "";
  }
}

async function clubForCustomer(customer: string | null | undefined): Promise<string | null> {
  if (!customer) return null;
  const [r] = (await db().execute(sql`select billing_club_for_customer(${customer}) as id`)) as unknown as Array<{ id: string | null }>;
  return r?.id ?? null;
}

type Invoice = {
  id: string; customer: string; status: string; amount_paid: number; amount_due: number; hosted_invoice_url?: string | null;
  period_start?: number; status_transitions?: { paid_at?: number | null }; subscription_details?: { metadata?: { club_id?: string } } | null;
};

export async function handleBillingEvent(event: { type: string; data: { object: unknown } }) {
  const o = event.data.object as Record<string, unknown>;
  if (event.type === "checkout.session.completed") {
    const session = o as { mode?: string; metadata?: { club_id?: string }; subscription?: string };
    const clubId = session.metadata?.club_id;
    if (session.mode !== "subscription" || !clubId || !session.subscription) return;
    const sub = await stripeApi<Sub>("GET", `/subscriptions/${session.subscription}`, null);
    await saveSubscription(clubId, sub);
    return;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = o as unknown as Sub;
    const clubId = sub.metadata?.club_id ?? (await clubForCustomer(sub.customer));
    if (clubId) await saveSubscription(clubId, sub);
    return;
  }
  if (event.type.startsWith("invoice.")) {
    const inv = o as unknown as Invoice;
    const clubId = inv.subscription_details?.metadata?.club_id ?? (await clubForCustomer(inv.customer));
    if (!clubId) return;
    const status = event.type === "invoice.payment_failed" ? "failed" : inv.status;
    const paidAt = inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : null;
    const row = {
      clubId,
      stripeInvoiceId: inv.id,
      amountPence: status === "paid" ? inv.amount_paid : inv.amount_due,
      status,
      hostedUrl: inv.hosted_invoice_url ?? null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
      paidAt,
    };
    await withClub({ clubId }, (tx) =>
      tx.insert(s.junbiInvoices).values(row).onConflictDoUpdate({
        target: s.junbiInvoices.stripeInvoiceId,
        set: { amountPence: row.amountPence, status: row.status, hostedUrl: row.hostedUrl, paidAt: row.paidAt },
      }),
    );
  }
}
