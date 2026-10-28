import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { decrypt, encrypt } from "@/lib/payments/crypto";
import { WEBHOOK_EVENTS, ownStripe, stripeApi, type OwnStripe } from "@/lib/payments/stripe";
import type { Result } from "./accounts";

/*
 * Clubs already on Stripe (for example through Martialytics) can connect their existing Stripe account with a
 * key, then take over the Direct Debits already running there. Families don't sign anything again: Junbi starts
 * its own subscription on the same saved payment method from the next payment date, and the old subscription
 * stops at that point.
 */

const KEY = /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/;

async function ownFor(clubId: string): Promise<{ own: OwnStripe; accountId: string } | null> {
  const [a] = await withClub({ clubId }, (tx) => tx.select().from(s.clubPaymentAccounts));
  if (!a || a.provider !== "stripe" || !a.accessTokenEnc) return null;
  const own = ownStripe({ provider: "stripe", accessToken: decrypt(a.accessTokenEnc) });
  return own ? { own, accountId: a.accountId } : null;
}

/** Connects the club's own Stripe account: checks the key, creates Junbi's webhook on that account, saves both. */
export async function connectStripeKey(actor: Actor, rawKey: string, base: string): Promise<Result<{ accountName: string | null; testMode: boolean }>> {
  assertCan(actor, "club.manage");
  const key = rawKey.trim();
  if (!KEY.test(key)) return { ok: false, errors: { key: "That doesn't look like a Stripe secret or restricted key. It starts with sk_live_ or rk_live_." } };
  const testMode = key.includes("_test_");

  // Who is this account? Restricted keys may not be allowed to read it, so fall back to a fingerprint of the key.
  let accountId = `key_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
  let accountName: string | null = null;
  try {
    const acct = await stripeApi<{ id: string; settings?: { dashboard?: { display_name?: string } }; business_profile?: { name?: string } }>("GET", "/account", null, undefined, undefined, key);
    accountId = acct.id;
    accountName = acct.settings?.dashboard?.display_name || acct.business_profile?.name || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/invalid api key|expired|revoked/i.test(msg)) return { ok: false, errors: { key: "Stripe didn't accept that key. Check you copied all of it." } };
  }

  // Remove any webhook from a previous connection, then make a fresh one.
  const previous = await ownFor(actor.clubId);
  if (previous?.own.whId) await stripeApi("DELETE", `/webhook_endpoints/${previous.own.whId}`, null, undefined, undefined, previous.own.key).catch(() => undefined);
  let wh: { id: string; secret: string };
  try {
    wh = await stripeApi<{ id: string; secret: string }>(
      "POST",
      "/webhook_endpoints",
      { url: `${base}/api/payments/webhook/stripe?club=${actor.clubId}`, enabled_events: WEBHOOK_EVENTS, description: "Junbi: payments and Direct Debits", api_version: "2024-06-20" },
      undefined,
      undefined,
      key,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return { ok: false, errors: { key: `Stripe wouldn't let Junbi set up its connection${/permission/i.test(msg) ? ": the key needs permission to write webhook endpoints" : ""}. ${msg}`.trim() } };
  }

  try {
    await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
      await tx.delete(s.clubPaymentAccounts).where(eq(s.clubPaymentAccounts.clubId, actor.clubId));
      await tx.insert(s.clubPaymentAccounts).values({ clubId: actor.clubId, provider: "stripe", accountId, accessTokenEnc: encrypt(JSON.stringify({ key, whsec: wh.secret, whId: wh.id })) });
      await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "payment_account", after: { provider: "stripe", accountId, via: "own_key", testMode } });
    });
  } catch (err) {
    await stripeApi("DELETE", `/webhook_endpoints/${wh.id}`, null, undefined, undefined, key).catch(() => undefined);
    if (/unique|23505/i.test(String(err)) || String((err as { code?: string }).code) === "23505") {
      return { ok: false, errors: { key: "That Stripe account is already connected to another club on Junbi." } };
    }
    throw err;
  }
  return { ok: true, value: { accountName, testMode } };
}

/** When disconnecting, take Junbi's webhook off the club's account. Best effort. */
export async function removeOwnStripeWebhook(clubId: string) {
  const o = await ownFor(clubId);
  if (o?.own.whId) await stripeApi("DELETE", `/webhook_endpoints/${o.own.whId}`, null, undefined, undefined, o.own.key).catch(() => undefined);
}

/* ---------- Taking over Direct Debits ---------- */

type StripePM = { id: string; type: string; bacs_debit?: { last4?: string }; card?: { brand?: string; last4?: string } } | null;
type StripeSub = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  metadata?: Record<string, string>;
  default_payment_method: StripePM | string;
  customer: { id: string; email: string | null; name: string | null; invoice_settings?: { default_payment_method: StripePM | string } } | string;
  items: { data: Array<{ quantity?: number; price: { unit_amount: number | null; nickname?: string | null; recurring: { interval: string; interval_count: number } | null; product: string | { name?: string } } }> };
};

const pmOf = (sub: StripeSub): StripePM => {
  const direct = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
  if (direct) return direct;
  const cust = typeof sub.customer === "object" ? sub.customer : null;
  const fallback = cust?.invoice_settings?.default_payment_method;
  return typeof fallback === "object" ? fallback : null;
};

const pmLabel = (pm: StripePM) =>
  !pm ? "No saved payment method" : pm.type === "bacs_debit" ? `Direct Debit${pm.bacs_debit?.last4 ? ` ··${pm.bacs_debit.last4}` : ""}` : pm.type === "card" ? `Card${pm.card?.last4 ? ` ··${pm.card.last4}` : ""}` : pm.type;

export type TakeoverRow = {
  subscriptionId: string;
  customerName: string;
  email: string | null;
  amountPence: number;
  interval: "monthly" | "annual" | "other";
  method: string;
  canTakeOver: boolean;
  reason: string | null;
  nextPaymentOn: string;
  description: string;
  household: { id: string; name: string; students: Array<{ id: string; name: string }> } | null;
  suggestedPlanId: string | null;
};

async function listSubscriptions(key: string): Promise<StripeSub[]> {
  const out: StripeSub[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await stripeApi<{ data: StripeSub[]; has_more: boolean }>(
      "GET",
      "/subscriptions",
      {
        status: "active",
        limit: 100,
        ...(after ? { starting_after: after } : {}),
        // Stripe allows at most 4 levels of expansion, so the product name isn't expanded; the price nickname is used instead.
        expand: ["data.customer", "data.default_payment_method", "data.customer.invoice_settings.default_payment_method"],
      },
      undefined,
      undefined,
      key,
    );
    out.push(...r.data);
    if (!r.has_more || !r.data.length) break;
    after = r.data[r.data.length - 1].id;
  }
  return out;
}

/** The Direct Debits running in the club's own Stripe that Junbi could take over, matched to Junbi families by email. */
export async function takeoverOptions(actor: Actor): Promise<{ connected: boolean; rows: TakeoverRow[]; plans: Array<{ id: string; name: string; amountPence: number; interval: string }> }> {
  assertCan(actor, "payments.manage");
  const o = await ownFor(actor.clubId);
  const plans = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.select({ id: s.plans.id, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval }).from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.amountPence)),
  );
  if (!o) return { connected: false, rows: [], plans };

  const subs = (await listSubscriptions(o.own.key)).filter((x) => !x.metadata?.junbi_student_id && !x.metadata?.junbi_replaced_by && !x.cancel_at_period_end);
  const emails = [...new Set(subs.map((x) => (typeof x.customer === "object" ? x.customer.email?.toLowerCase() : null)).filter(Boolean) as string[])];
  const families = emails.length
    ? await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
        const gs = await tx
          .select({ email: s.guardians.email, householdId: s.guardians.householdId, name: s.households.name })
          .from(s.guardians)
          .innerJoin(s.households, eq(s.households.id, s.guardians.householdId))
          .where(inArray(sql`lower(${s.guardians.email})`, emails));
        const ids = [...new Set(gs.map((g) => g.householdId))];
        const kids = ids.length
          ? await tx.select({ id: s.students.id, first: s.students.firstName, last: s.students.lastName, householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(inArray(s.students.householdId, ids))
          : [];
        return { gs, kids: kids.filter((k) => actor.sites === "all" || actor.sites.includes(k.siteId)) };
      })
    : { gs: [], kids: [] };

  const rows = subs.map((sub): TakeoverRow => {
    const cust = typeof sub.customer === "object" ? sub.customer : null;
    const email = cust?.email?.toLowerCase() ?? null;
    const items = sub.items.data;
    const amountPence = items.reduce((n, i) => n + (i.price.unit_amount ?? 0) * (i.quantity ?? 1), 0);
    const rec = items[0]?.price.recurring;
    const interval = rec?.interval === "month" && rec.interval_count === 1 ? "monthly" : rec?.interval === "year" && rec.interval_count === 1 ? "annual" : "other";
    const pm = pmOf(sub);
    const g = email ? families.gs.find((x) => x.email?.toLowerCase() === email) : undefined;
    const students = g ? families.kids.filter((k) => k.householdId === g.householdId).map((k) => ({ id: k.id, name: `${k.first} ${k.last}` })) : [];
    const reason = !pm ? "No saved payment method on this subscription." : interval === "other" ? "Only monthly or yearly payments can be taken over." : items.length !== 1 ? "This subscription has more than one item." : null;
    const product = items[0]?.price.product;
    return {
      subscriptionId: sub.id,
      customerName: cust?.name || cust?.email || "Unknown customer",
      email,
      amountPence,
      interval,
      method: pmLabel(pm),
      canTakeOver: !reason,
      reason,
      nextPaymentOn: new Date(sub.current_period_end * 1000).toISOString().slice(0, 10),
      description: typeof product === "object" && product?.name ? product.name : items[0]?.price.nickname ?? "",
      household: g ? { id: g.householdId, name: g.name, students } : null,
      suggestedPlanId: plans.find((p) => p.amountPence === amountPence && p.interval === interval)?.id ?? null,
    };
  });
  rows.sort((a, b) => Number(!!b.household) - Number(!!a.household) || a.customerName.localeCompare(b.customerName));
  return { connected: true, rows, plans };
}

const takeoverSchema = z
  .array(z.object({ subscriptionId: z.string().regex(/^sub_[A-Za-z0-9]+$/), studentId: z.string().uuid(), planId: z.string().uuid() }))
  .min(1, "Choose at least one family to take over.")
  .max(300);

export type TakeoverResult = { subscriptionId: string; ok: boolean; message: string };

/**
 * Takes over the chosen subscriptions. For each one: a new Junbi subscription on the same customer and saved
 * payment method, starting on the old one's next payment date (nothing is charged before then), and the old one
 * set to stop at that date. Safe to repeat: Stripe idempotency keys and the old subscription's metadata stop doubles.
 */
export async function takeOver(actor: Actor, input: z.input<typeof takeoverSchema>): Promise<Result<{ results: TakeoverResult[] }>> {
  assertCan(actor, "payments.manage");
  const parsed = takeoverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { form: parsed.error.issues[0].message } };
  const o = await ownFor(actor.clubId);
  if (!o) return { ok: false, errors: { form: "Connect your own Stripe account first." } };
  const key = o.own.key;

  const lookups = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const studentIds = [...new Set(parsed.data.map((r) => r.studentId))];
    const planIds = [...new Set(parsed.data.map((r) => r.planId))];
    const students = await tx.select({ id: s.students.id, first: s.students.firstName, householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(inArray(s.students.id, studentIds));
    const plans = await tx.select().from(s.plans).where(and(inArray(s.plans.id, planIds), eq(s.plans.active, true)));
    return { students: students.filter((x) => actor.sites === "all" || actor.sites.includes(x.siteId)), plans };
  });

  const products = new Map<string, string>();
  const results: TakeoverResult[] = [];
  for (const row of parsed.data) {
    const st = lookups.students.find((x) => x.id === row.studentId);
    const plan = lookups.plans.find((x) => x.id === row.planId);
    if (!st || !plan || plan.interval === "termly") {
      results.push({ subscriptionId: row.subscriptionId, ok: false, message: "Choose a student and a monthly or yearly price." });
      continue;
    }
    try {
      const sub = await stripeApi<StripeSub>(
        "GET",
        `/subscriptions/${row.subscriptionId}`,
        { expand: ["customer", "default_payment_method", "customer.invoice_settings.default_payment_method"] },
        undefined,
        undefined,
        key,
      );
      const customerId = typeof sub.customer === "object" ? sub.customer.id : sub.customer;
      // Saves the membership on Junbi's side. Safe to run again: skipped if it's already there.
      const save = async (newSubId: string, startsAtUnix: number) => {
        const startsOn = new Date(startsAtUnix * 1000).toISOString().slice(0, 10);
        await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
          const [have] = await tx.select({ id: s.memberships.id }).from(s.memberships).where(eq(s.memberships.providerSubscriptionId, newSubId));
          if (have) return;
          const [existing] = await tx.select({ id: s.mandates.id }).from(s.mandates).where(eq(s.mandates.providerCustomerId, customerId));
          if (!existing) {
            await tx.insert(s.mandates).values({ clubId: actor.clubId, householdId: st.householdId, provider: "stripe", providerCustomerId: customerId, providerMandateId: null, status: "active" });
          }
          await tx.insert(s.memberships).values({ clubId: actor.clubId, studentId: st.id, planId: plan.id, startsOn, providerSubscriptionId: newSubId, status: "active" });
          await tx.update(s.students).set({ status: "active" }).where(and(eq(s.students.id, st.id), inArray(s.students.status, ["trial", "pending"])));
          await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "direct_debit_takeover", entityId: st.id, after: { from: sub.id, to: newSubId, planId: plan.id, startsOn } });
        });
      };
      if (sub.metadata?.junbi_replaced_by) {
        // Taken over on Stripe already. If Junbi's side didn't get saved last time, save it now.
        await save(sub.metadata.junbi_replaced_by, sub.current_period_end);
        results.push({ subscriptionId: row.subscriptionId, ok: true, message: "Already taken over." });
        continue;
      }
      if (sub.status !== "active") throw new Error("This subscription isn't active any more.");
      const pm = pmOf(sub);
      if (!pm) throw new Error("No saved payment method on this subscription.");
      const startsAt = sub.current_period_end;
      if (startsAt * 1000 < Date.now() + 3600_000) throw new Error("Its next payment is due within the hour. Try again tomorrow.");

      // An earlier attempt may have made Junbi's subscription but not stopped the old one. Reuse it rather
      // than making a second (Stripe only remembers repeat requests for 24 hours).
      const theirs = await stripeApi<{ data: Array<{ id: string; status: string; metadata?: Record<string, string> }> }>(
        "GET", "/subscriptions", { customer: customerId, status: "all", limit: 100 }, undefined, undefined, key,
      );
      let createdId = theirs.data.find((x) => x.metadata?.junbi_takeover_from === sub.id && x.status !== "canceled" && x.status !== "incomplete_expired")?.id;
      if (!createdId) {
        let productId = products.get(plan.id);
        if (!productId) {
          const prod = await stripeApi<{ id: string }>("POST", "/products", { name: plan.name, metadata: { junbi_plan_id: plan.id } }, undefined, `junbi-product-${plan.id}`, key);
          productId = prod.id;
          products.set(plan.id, productId);
        }
        const created = await stripeApi<{ id: string }>(
          "POST",
          "/subscriptions",
          {
            customer: customerId,
            default_payment_method: pm.id,
            items: [{ price_data: { currency: "gbp", product: productId, unit_amount: plan.amountPence, recurring: { interval: plan.interval === "annual" ? "year" : "month" } } }],
            // Nothing is charged until the old subscription's next payment date; from then on Junbi's subscription bills.
            trial_end: startsAt,
            proration_behavior: "none",
            metadata: { junbi_student_id: st.id, junbi_plan_id: plan.id, junbi_takeover_from: sub.id },
          },
          undefined,
          `junbi-takeover-${sub.id}`,
          key,
        );
        createdId = created.id;
      }
      await stripeApi("POST", `/subscriptions/${sub.id}`, { cancel_at_period_end: true, metadata: { junbi_replaced_by: createdId } }, undefined, `junbi-takeover-stop-${sub.id}`, key);
      await save(createdId, startsAt);
      results.push({ subscriptionId: row.subscriptionId, ok: true, message: `Taken over. Junbi collects from ${new Date(startsAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` });
    } catch (err) {
      results.push({ subscriptionId: row.subscriptionId, ok: false, message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }
  return { ok: true, value: { results } };
}
