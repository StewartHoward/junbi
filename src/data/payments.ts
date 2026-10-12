import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { decrypt, encrypt, verifyState, signState } from "@/lib/payments/crypto";
import { PROVIDERS, provider, type ConnectedAccount, type ProviderId, type SetupItem } from "@/lib/payments";
import type { Result } from "./accounts";
import { formatPence } from "./students";
import { appUrl, sendEmail, templates } from "@/lib/email";
import { removeOwnStripeWebhook } from "./stripe-own";

/*
 * Club payments: each club connects its own Stripe or GoCardless account, sets its membership prices,
 * and families set up Direct Debit from the sign-up link. Money goes straight to the club; Junbi takes 0%.
 * Provider webhooks finish the job (see src/app/api/payments/webhook/*).
 */

const providerId = z.enum(PROVIDERS);

/* ---------- Settings ---------- */

export async function paymentSettings(actor: Actor) {
  assertCan(actor, "payments.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [account] = await tx
      .select({ provider: s.clubPaymentAccounts.provider, accountId: s.clubPaymentAccounts.accountId, connectedAt: s.clubPaymentAccounts.connectedAt, tokenEnc: s.clubPaymentAccounts.accessTokenEnc })
      .from(s.clubPaymentAccounts);
    const plans = await tx.select().from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.amountPence));
    const mandates = await tx
      .select({ status: s.mandates.status, count: sql<number>`count(*)::int` })
      .from(s.mandates)
      .groupBy(s.mandates.status);
    const recent = await tx
      .select({ id: s.payments.id, description: s.payments.description, amountPence: s.payments.amountPence, chargeDate: s.payments.chargeDate, status: s.payments.status, family: s.households.name })
      .from(s.payments)
      .innerJoin(s.households, eq(s.households.id, s.payments.householdId))
      .orderBy(desc(s.payments.chargeDate))
      .limit(20);
    const [club] = await tx.select({ fee: s.clubs.signupFeePence }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    return {
      // ownKey: the club connected its existing Stripe account with a key, so it can take over Direct Debits running there.
      account: account
        ? (() => {
            const own = account.provider === "stripe" && account.tokenEnc ? (JSON.parse(decrypt(account.tokenEnc)) as { key?: string }).key ?? null : null;
            return { provider: account.provider, accountId: account.accountId, connectedAt: account.connectedAt, ownKey: Boolean(own), testMode: Boolean(own?.includes("_test_")) };
          })()
        : null,
      plans,
      signupFeePence: club?.fee ?? 0,
      mandates: Object.fromEntries(mandates.map((m) => [m.status, m.count])) as Record<string, number>,
      recent,
      available: { stripe: provider("stripe").available(), gocardless: provider("gocardless").available() },
    };
  });
}

/**
 * Money at a glance for the dashboard: what's come in this month, what the club expects each month from active
 * memberships, what's outstanding (failed or retrying payments in the last 90 days) and members with no Direct Debit.
 */
export async function moneySummary(actor: Actor) {
  assertCan(actor, "payments.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [r] = (await tx.execute(sql`
      with month as (select date_trunc('month', (now() at time zone 'Europe/London'))::date as start)
      select
        (select coalesce(sum(amount_pence), 0)::int from payments, month where status in ('confirmed', 'paid_out') and charge_date >= month.start) as collected,
        (select coalesce(sum(amount_pence), 0)::int from payments, month where status in ('pending', 'submitted') and charge_date >= month.start) as on_the_way,
        (select coalesce(sum(case p.interval when 'monthly' then p.amount_pence when 'annual' then p.amount_pence / 12.0 else p.amount_pence * 3 / 12.0 end), 0)::int
           from memberships m join plans p on p.id = m.plan_id join students s on s.id = m.student_id
           where m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date) and s.status = 'active') as expected,
        (select coalesce(sum(amount_pence), 0)::int from payments where status in ('failed', 'retrying', 'charged_back') and charge_date >= current_date - 90) as outstanding,
        (select count(distinct household_id)::int from payments where status in ('failed', 'retrying', 'charged_back') and charge_date >= current_date - 90) as outstanding_families,
        (select count(*)::int from students s
           where s.status = 'active'
             and exists (select 1 from memberships m where m.student_id = s.id and m.status = 'active')
             and not exists (select 1 from mandates d where d.household_id = s.household_id and d.status in ('active', 'submitted', 'pending_submission'))) as no_direct_debit
    `)) as unknown as Array<{ collected: number; on_the_way: number; expected: number; outstanding: number; outstanding_families: number; no_direct_debit: number }>;
    return {
      collectedPence: r.collected,
      onTheWayPence: r.on_the_way,
      expectedMonthlyPence: r.expected,
      outstandingPence: r.outstanding,
      outstandingFamilies: r.outstanding_families,
      noDirectDebit: r.no_direct_debit,
    };
  });
}

/** Where to send the owner to connect their account. */
export function connectUrl(actor: Actor, id: string, redirectUri: string): string {
  assertCan(actor, "club.manage");
  const p = provider(providerId.parse(id));
  if (!p.available()) throw new Error(`${p.name} isn't available on Junbi yet.`);
  return p.connectUrl(signState({ clubId: actor.clubId, provider: p.id }), redirectUri);
}

/**
 * Where to send the owner to connect: Stripe's hosted sign-up (Junbi makes the club's account) or,
 * for GoCardless, its OAuth page.
 */
export async function startConnect(actor: Actor & { clubName: string }, id: string, base: string, email: string): Promise<string> {
  assertCan(actor, "club.manage");
  const p = provider(providerId.parse(id));
  if (!p.available()) throw new Error(`${p.name} isn't available on Junbi yet.`);
  const callback = `${base}/api/payments/callback/${p.id}`;
  if (!p.onboard) return p.connectUrl(signState({ clubId: actor.clubId, provider: p.id }), callback);
  return p.onboard({
    clubId: actor.clubId,
    clubName: actor.clubName,
    email,
    returnUrl: (accountId) => `${callback}?state=${encodeURIComponent(signState({ clubId: actor.clubId, provider: p.id, accountId }, 3 * 3600))}`,
    refreshUrl: `${base}/api/payments/connect/${p.id}`,
  });
}

/** Back from the provider: swap the code for the club's account and save it. */
export async function finishConnect(actor: Actor, id: string, code: string | null, state: string | null, redirectUri: string): Promise<Result<{ provider: ProviderId }>> {
  assertCan(actor, "club.manage");
  const pid = providerId.safeParse(id);
  const st = verifyState(state);
  const p = pid.success ? provider(pid.data) : null;
  const hosted = Boolean(p?.finishOnboard && st?.accountId);
  if (!pid.success || !p || !st || st.clubId !== actor.clubId || st.provider !== pid.data || (!code && !hosted)) {
    return { ok: false, errors: { form: "That didn't work. Please try connecting again." } };
  }
  let acc: { accountId: string; accessToken?: string };
  try {
    if (hosted) {
      const r = await p.finishOnboard!(st.accountId!);
      if (!r.submitted) return { ok: false, errors: { form: "Stripe sign-up isn't finished yet. Click Connect Stripe to carry on where you left off." } };
      acc = { accountId: r.accountId };
    } else {
      acc = await p.completeConnect(code!, redirectUri);
    }
  } catch (err) {
    return { ok: false, errors: { form: err instanceof Error ? err.message : "That didn't work. Please try again." } };
  }
  try {
    await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
      await tx.delete(s.clubPaymentAccounts).where(eq(s.clubPaymentAccounts.clubId, actor.clubId));
      await tx.insert(s.clubPaymentAccounts).values({ clubId: actor.clubId, provider: pid.data, accountId: acc.accountId, accessTokenEnc: acc.accessToken ? encrypt(acc.accessToken) : null });
      await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "payment_account", after: { provider: pid.data, accountId: acc.accountId } });
    });
  } catch (err) {
    if (String((err as { code?: string }).code) === "23505" || /unique/i.test(String(err))) {
      return { ok: false, errors: { form: "That account is already connected to another club on Junbi." } };
    }
    throw err;
  }
  return { ok: true, value: { provider: pid.data } };
}

export async function disconnectPayments(actor: Actor) {
  assertCan(actor, "club.manage");
  await removeOwnStripeWebhook(actor.clubId);
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [a] = await tx.select().from(s.clubPaymentAccounts);
    await tx.delete(s.clubPaymentAccounts).where(eq(s.clubPaymentAccounts.clubId, actor.clubId));
    if (a) await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "delete", entity: "payment_account", before: { provider: a.provider, accountId: a.accountId } });
  });
}

/* ---------- Prices ---------- */

const planSchema = z.object({
  name: z.string().trim().min(2, "Give it a name, e.g. Kids monthly.").max(80),
  amount: z
    .string()
    .trim()
    .transform((v) => v.replace(/^£/, ""))
    .refine((v) => /^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) >= 1, "Enter a price from £1, e.g. 35 or 35.50."),
  interval: z.enum(["monthly", "annual"], { message: "Choose monthly or yearly." }),
  showOnSignup: z.boolean().optional().default(true),
});

/** The club's prices and whether Direct Debit is connected, for the Settings page. */
export async function listPlans(actor: Actor) {
  assertCan(actor, "payments.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const plans = await tx
      .select({ id: s.plans.id, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval, showOnSignup: s.plans.showOnSignup })
      .from(s.plans)
      .where(eq(s.plans.active, true))
      .orderBy(asc(s.plans.amountPence));
    const [a] = await tx.select({ provider: s.clubPaymentAccounts.provider }).from(s.clubPaymentAccounts);
    const [club] = await tx.select({ fee: s.clubs.signupFeePence }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    return { plans, connected: Boolean(a), signupFeePence: club?.fee ?? 0 };
  });
}

/** The club's one-off sign-up fee per new member. Empty or 0 turns it off. */
export async function setSignupFee(actor: Actor, amount: string): Promise<Result<{ pence: number }>> {
  assertCan(actor, "payments.manage");
  const v = amount.trim().replace(/^£/, "");
  if (v && !(/^\d{1,4}(\.\d{1,2})?$/.test(v))) return { ok: false, errors: { signupFee: "Enter an amount, e.g. 25 or 25.50. Leave empty for no fee." } };
  const pence = v ? Math.round(Number(v) * 100) : 0;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.update(s.clubs).set({ signupFeePence: pence }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "signup_fee", entityId: actor.clubId, after: { pence } });
  });
  return { ok: true, value: { pence } };
}

export async function addPlan(actor: Actor, input: z.input<typeof planSchema>): Promise<Result<{ id: string }>> {
  assertCan(actor, "payments.manage");
  const p = planSchema.safeParse(input);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const amountPence = Math.round(Number(p.data.amount) * 100);
  const [row] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.insert(s.plans).values({ clubId: actor.clubId, name: p.data.name, amountPence, interval: p.data.interval, showOnSignup: p.data.showOnSignup }).returning({ id: s.plans.id }),
  );
  return { ok: true, value: { id: row.id } };
}

/** Takes a price off the sign-up form. Families already paying it carry on. */
/** Show or hide a price on the sign-up link. Hidden prices still work for existing members, takeovers and staff. */
export async function setPlanOnSignup(actor: Actor, planId: string, show: boolean) {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(planId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.plans).set({ showOnSignup: show }).where(eq(s.plans.id, planId)));
}

export async function archivePlan(actor: Actor, planId: string) {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(planId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.plans).set({ active: false }).where(eq(s.plans.id, planId)));
}

/* ---------- Staff adding a membership ---------- */

/**
 * Staff put a student on a membership. When the club takes Direct Debit and the family isn't paying
 * by Direct Debit yet, the parent is emailed a link to set it up and the membership starts once they have.
 * Otherwise the membership starts now.
 */
export async function addStudentMembership(
  actor: Actor,
  studentId: string,
  input: { planId: string; startsOn?: string; withSignupFee?: boolean },
): Promise<Result<{ emailed: string | null }>> {
  // Putting someone on a paid plan (and possibly charging their family) is a payments job.
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(studentId).success) return { ok: false, errors: { form: "Student not found." } };
  if (!z.string().uuid().safeParse(input.planId).success) return { ok: false, errors: { planId: "Choose a membership." } };
  const startsOn = input.startsOn && /^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) ? input.startsOn : new Date().toISOString().slice(0, 10);

  const found = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || (actor.sites !== "all" && !actor.sites.includes(st.siteId))) return { error: { form: "Student not found." } as Record<string, string> };
    const [plan] = await tx.select().from(s.plans).where(and(eq(s.plans.id, input.planId), eq(s.plans.active, true)));
    if (!plan) return { error: { planId: "Choose a membership." } as Record<string, string> };
    const account = await accountFor(tx);
    const live = account && provider(account.provider).available() && plan.interval !== "termly";
    const [paying] = live
      ? await tx
          .select({ id: s.mandates.id, providerMandateId: s.mandates.providerMandateId, providerCustomerId: s.mandates.providerCustomerId })
          .from(s.mandates)
          .where(and(eq(s.mandates.householdId, st.householdId), inArray(s.mandates.status, ["active", "submitted", "pending_submission"])))
          .orderBy(desc(s.mandates.createdAt))
          .limit(1)
      : [];
    // The family already pays by Direct Debit: add this membership to it rather than starting it unpaid.
    if (live && paying) {
      const [other] = await tx
        .select({ subId: s.memberships.providerSubscriptionId })
        .from(s.memberships)
        .innerJoin(s.students, eq(s.students.id, s.memberships.studentId))
        .where(and(eq(s.students.householdId, st.householdId), eq(s.memberships.status, "active"), sql`${s.memberships.providerSubscriptionId} is not null`))
        .limit(1);
      return { existing: { st, plan, account, mandate: paying, otherSubscriptionId: other?.subId ?? null } };
    }
    const [payer] = await tx
      .select({ firstName: s.guardians.firstName, lastName: s.guardians.lastName, email: s.guardians.email })
      .from(s.guardians)
      .where(eq(s.guardians.householdId, st.householdId))
      .orderBy(desc(s.guardians.isPayer), asc(s.guardians.createdAt))
      .limit(1);
    if (live && !paying && payer?.email) {
      const [club] = await tx.select({ name: s.clubs.name, token: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
      return { send: { st, plan, payer: { ...payer, email: payer.email }, club, provider: account.provider } };
    }
    await tx.insert(s.memberships).values({ clubId: actor.clubId, studentId: st.id, planId: plan.id, startsOn, status: "active" });
    await tx.update(s.students).set({ status: "active" }).where(and(eq(s.students.id, st.id), eq(s.students.status, "trial")));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "membership", entityId: st.id, after: { planId: plan.id } });
    return { added: true };
  });
  if ("error" in found) return { ok: false, errors: found.error! };
  if ("existing" in found && found.existing) {
    const { st, plan, account, mandate, otherSubscriptionId } = found.existing;
    let subscriptionId: string;
    try {
      subscriptionId = await addToDirectDebit(account, { mandateId: mandate.providerMandateId, customerId: mandate.providerCustomerId, otherSubscriptionId }, {
        studentId: st.id,
        planId: plan.id,
        name: `${plan.name} (${st.firstName})`,
        amountPence: plan.amountPence,
        interval: plan.interval === "annual" ? "annual" : "monthly",
      });
    } catch (err) {
      console.error("adding to existing Direct Debit failed", err);
      return { ok: false, errors: { form: `We couldn't add this to the family's Direct Debit: ${(err as Error).message}` } };
    }
    await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
      await tx.insert(s.memberships).values({ clubId: actor.clubId, studentId: st.id, planId: plan.id, startsOn, providerSubscriptionId: subscriptionId, status: "active" });
      await tx.update(s.students).set({ status: "active" }).where(and(eq(s.students.id, st.id), eq(s.students.status, "trial")));
      await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "membership", entityId: st.id, after: { planId: plan.id, subscriptionId } });
    });
    return { ok: true, value: { emailed: null } };
  }
  if (!("send" in found) || !found.send) return { ok: true, value: { emailed: null } };

  const { st, plan, payer, club, provider: pid } = found.send;
  const base = await appUrl();
  const r = await startJoinPayment(actor.clubId, {
    householdId: st.householdId,
    email: payer.email,
    firstName: payer.firstName,
    lastName: payer.lastName,
    items: [{ studentId: st.id, planId: plan.id }],
    successUrl: (id) => `${base}/join/${club.token}/done?setup=${id}`,
    cancelUrl: `${base}/join/${club.token}/done?cancelled=1`,
    withSignupFee: input.withSignupFee ?? false,
  });
  if (!r.ok) return { ok: false, errors: { form: "We couldn't make a Direct Debit link just now. Try again in a minute." } };
  const price = `${formatPence(plan.amountPence)} ${plan.interval === "annual" ? "a year" : "a month"}`;
  const t = templates.paymentLink(`${payer.firstName} ${payer.lastName}`, club.name, st.firstName, `${plan.name} (${price})`, pid === "stripe" ? "Stripe" : "GoCardless", r.value.url);
  await sendEmail({ to: payer.email, ...t, template: "payment-link", clubId: actor.clubId });
  return { ok: true, value: { emailed: payer.email } };
}

/**
 * A new membership on a family's existing Direct Debit. GoCardless: a subscription on their mandate.
 * Stripe: a subscription on their customer using the payment method their other membership already uses.
 */
async function addToDirectDebit(
  account: ConnectedAccount,
  dd: { mandateId: string | null; customerId: string | null; otherSubscriptionId: string | null },
  item: SetupItem,
): Promise<string> {
  const key = `add-${item.studentId}-${item.planId}-${new Date().toISOString().slice(0, 10)}`;
  if (process.env.PAYMENTS_FAKE === "1") return `sub_fake_add_${item.studentId}`;
  if (account.provider === "gocardless") {
    if (!dd.mandateId || !account.accessToken) throw new Error("their mandate isn't ready yet");
    const { gcApi } = await import("@/lib/payments/gocardless");
    const sub = await gcApi<{ subscriptions: { id: string } }>(account.accessToken, "POST", "/subscriptions", {
      subscriptions: {
        amount: item.amountPence,
        currency: "GBP",
        interval_unit: item.interval === "annual" ? "yearly" : "monthly",
        name: item.name.slice(0, 255),
        metadata: { junbi_student_id: item.studentId },
        links: { mandate: dd.mandateId },
      },
    }, key);
    return sub.subscriptions.id;
  }
  const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
  const auth = stripeAuth(account);
  const call = <T,>(method: "GET" | "POST", path: string, params: Record<string, unknown> | null, idem?: string) => stripeApi<T>(method, path, params, auth.account, idem, auth.key);
  if (!dd.customerId) throw new Error("their Stripe customer isn't known yet");
  let paymentMethod: string | null = null;
  if (dd.otherSubscriptionId) {
    const other = await call<{ default_payment_method: string | null }>("GET", `/subscriptions/${dd.otherSubscriptionId}`, null).catch(() => null);
    paymentMethod = other?.default_payment_method ?? null;
  }
  if (!paymentMethod) {
    const cust = await call<{ invoice_settings?: { default_payment_method?: string | null } }>("GET", `/customers/${dd.customerId}`, null);
    paymentMethod = cust.invoice_settings?.default_payment_method ?? null;
  }
  if (!paymentMethod) {
    for (const type of ["bacs_debit", "card"]) {
      const list = await call<{ data: Array<{ id: string }> }>("GET", "/payment_methods", { customer: dd.customerId, type, limit: 1 });
      if (list.data[0]) { paymentMethod = list.data[0].id; break; }
    }
  }
  if (!paymentMethod) throw new Error("no saved payment method on their Stripe account");
  const product = await call<{ id: string }>("POST", "/products", { name: item.name, metadata: { junbi_student_id: item.studentId, junbi_plan_id: item.planId } }, `${key}-product`);
  const sub = await call<{ id: string }>("POST", "/subscriptions", {
    customer: dd.customerId,
    default_payment_method: paymentMethod,
    items: [{ price_data: { currency: "gbp", unit_amount: item.amountPence, recurring: { interval: item.interval === "annual" ? "year" : "month" }, product: product.id } }],
    metadata: { junbi_student_id: item.studentId, junbi_plan_id: item.planId },
  }, `${key}-sub`);
  return sub.id;
}

/** Closes unfinished Stripe Checkout pages or GoCardless billing requests from earlier links. */
async function expireOldLinks(account: ConnectedAccount, refs: string[]) {
  for (const ref of refs) {
    if (account.provider === "stripe" && ref.startsWith("cs_")) {
      const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
      const auth = stripeAuth(account);
      await stripeApi("POST", `/checkout/sessions/${ref}/expire`, {}, auth.account, undefined, auth.key).catch(() => {});
    } else if (account.provider === "gocardless" && ref.startsWith("BRQ") && account.accessToken) {
      const { gcApi } = await import("@/lib/payments/gocardless");
      await gcApi(account.accessToken, "POST", `/billing_requests/${ref}/actions/cancel`, { data: {} }).catch(() => {});
    }
  }
}

/* ---------- Sign-up link ---------- */

async function accountFor(tx: Tx): Promise<ConnectedAccount | null> {
  const [a] = await tx.select().from(s.clubPaymentAccounts);
  if (!a) return null;
  return { provider: a.provider as ProviderId, accountId: a.accountId, accessToken: a.accessTokenEnc ? decrypt(a.accessTokenEnc) : undefined };
}

/** What the public sign-up form needs to offer memberships. Null when the club isn't taking payments online. */
/**
 * The memberships families choose from on the sign-up link. Shown whenever the club has set prices;
 * provider is set when the club also takes Direct Debit at sign-up.
 */
export async function joinPlans(tx: Tx) {
  const plans = await tx
    .select({ id: s.plans.id, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval })
    .from(s.plans)
    .where(and(eq(s.plans.active, true), eq(s.plans.showOnSignup, true)))
    .orderBy(asc(s.plans.amountPence));
  if (!plans.length) return null;
  const [a] = await tx.select({ provider: s.clubPaymentAccounts.provider }).from(s.clubPaymentAccounts);
  const live = a && provider(a.provider as ProviderId).available();
  const [club] = await tx.select({ fee: s.clubs.signupFeePence }).from(s.clubs).where(sql`${s.clubs.id} = current_club_id()`);
  // Direct Debit can't do termly prices, so they're not offered while it's on.
  const offered = live ? plans.filter((p) => p.interval !== "termly") : plans;
  if (!offered.length) return null;
  return { provider: live ? (a.provider as ProviderId) : null, plans: offered, signupFeePence: club?.fee ?? 0 };
}

export async function joinPaymentOptions(tx: Tx) {
  const [a] = await tx.select({ provider: s.clubPaymentAccounts.provider }).from(s.clubPaymentAccounts);
  if (!a || !provider(a.provider as ProviderId).available()) return null;
  const plans = await tx.select({ id: s.plans.id, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval }).from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.amountPence));
  if (!plans.length) return null;
  return { provider: a.provider as ProviderId, plans };
}

/** Starts Direct Debit for a family that has just signed up. Returns the provider page to send them to. */
export async function startJoinPayment(
  clubId: string,
  input: { householdId: string; email: string; firstName: string; lastName: string; items: Array<{ studentId: string; planId: string }>; successUrl: (setupId: string) => string; cancelUrl: string; withSignupFee?: boolean },
): Promise<Result<{ url: string; setupId: string }>> {
  const prepared = await withClub({ clubId }, async (tx) => {
    const account = await accountFor(tx);
    if (!account) return null;
    const planIds = [...new Set(input.items.map((i) => i.planId))];
    const plans = await tx.select().from(s.plans).where(and(inArray(s.plans.id, planIds), eq(s.plans.active, true)));
    const students = await tx.select({ id: s.students.id, firstName: s.students.firstName }).from(s.students).where(inArray(s.students.id, input.items.map((i) => i.studentId)));
    const items: SetupItem[] = input.items.flatMap((i) => {
      const plan = plans.find((p) => p.id === i.planId);
      const st = students.find((x) => x.id === i.studentId);
      if (!plan || !st || plan.interval === "termly") return [];
      return [{ studentId: st.id, planId: plan.id, name: `${plan.name} (${st.firstName})`, amountPence: plan.amountPence, interval: plan.interval }];
    });
    if (!items.length) return null;
    const [club] = await tx.select({ fee: s.clubs.signupFeePence }).from(s.clubs).where(eq(s.clubs.id, clubId));
    const signupFeePence = input.withSignupFee === false ? 0 : (club?.fee ?? 0) * items.length;
    // An earlier link for this family that wasn't finished: close it so they can't end up paying twice.
    const stale = await tx
      .select({ id: s.paymentSetups.id, ref: s.paymentSetups.providerRef })
      .from(s.paymentSetups)
      .where(and(eq(s.paymentSetups.householdId, input.householdId), eq(s.paymentSetups.status, "pending")));
    if (stale.length) await tx.update(s.paymentSetups).set({ status: "abandoned" }).where(inArray(s.paymentSetups.id, stale.map((x) => x.id)));
    const [setup] = await tx
      .insert(s.paymentSetups)
      .values({ clubId, householdId: input.householdId, provider: account.provider, items: items.map((i) => ({ studentId: i.studentId, planId: i.planId })), signupFeePence })
      .returning({ id: s.paymentSetups.id });
    return { account, items, setupId: setup.id, signupFeePence, stale: stale.map((x) => x.ref).filter((r): r is string => Boolean(r)) };
  });
  if (!prepared) return { ok: false, errors: { form: "Online payment isn't set up for this club." } };
  await expireOldLinks(prepared.account, prepared.stale).catch((err) => console.error("expiring old payment links failed", err));

  try {
    const r = await provider(prepared.account.provider).startSetup(prepared.account, {
      setupId: prepared.setupId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      items: prepared.items,
      signupFeePence: prepared.signupFeePence,
      successUrl: input.successUrl(prepared.setupId),
      cancelUrl: input.cancelUrl,
    });
    await withClub({ clubId }, (tx) => tx.update(s.paymentSetups).set({ providerRef: r.ref }).where(eq(s.paymentSetups.id, prepared.setupId)));
    return { ok: true, value: { url: r.url, setupId: prepared.setupId } };
  } catch (err) {
    console.error("Starting Direct Debit failed", err);
    return { ok: false, errors: { form: "We couldn't open the Direct Debit page. You're signed up, and the club can send you a payment link." } };
  }
}

export async function setupStatus(clubId: string, setupId: string) {
  if (!z.string().uuid().safeParse(setupId).success) return null;
  const [r] = await withClub({ clubId }, (tx) => tx.select({ status: s.paymentSetups.status, provider: s.paymentSetups.provider }).from(s.paymentSetups).where(eq(s.paymentSetups.id, setupId)));
  return r ?? null;
}

/* ---------- Webhook side ---------- */

export async function clubForAccount(p: ProviderId, accountId: string): Promise<string | null> {
  const [r] = (await db().execute(sql`select payments_club_for_account(${p}, ${accountId}) as club`)) as unknown as Array<{ club: string | null }>;
  return r?.club ?? null;
}

export async function connectedAccount(clubId: string) {
  return withClub({ clubId }, accountFor);
}

export async function loadSetup(clubId: string, setupId: string) {
  if (!z.string().uuid().safeParse(setupId).success) return null;
  return withClub({ clubId }, async (tx) => {
    const [setup] = await tx.select().from(s.paymentSetups).where(eq(s.paymentSetups.id, setupId));
    if (!setup) return null;
    const items = setup.items as Array<{ studentId: string; planId: string }>;
    const plans = items.length ? await tx.select().from(s.plans).where(inArray(s.plans.id, items.map((i) => i.planId))) : [];
    const students = items.length ? await tx.select({ id: s.students.id, firstName: s.students.firstName }).from(s.students).where(inArray(s.students.id, items.map((i) => i.studentId))) : [];
    return {
      ...setup,
      items: items.map((i) => ({ ...i, plan: plans.find((p) => p.id === i.planId), firstName: students.find((x) => x.id === i.studentId)?.firstName ?? "" })),
    };
  });
}

/**
 * The family finished setting up Direct Debit: save the mandate, start each membership and make the
 * students Active. Safe to call twice.
 */
export async function completeSetup(
  clubId: string,
  setupId: string,
  r: { customerId: string | null; mandateId: string | null; subscriptions: Array<{ studentId: string; planId: string; subscriptionId: string | null }> },
) {
  await withClub({ clubId }, async (tx) => {
    const [setup] = await tx.select().from(s.paymentSetups).where(eq(s.paymentSetups.id, setupId)).for("update");
    if (!setup || setup.status === "completed") return;
    const today = new Date().toISOString().slice(0, 10);
    const existing = r.mandateId
      ? await tx.select({ id: s.mandates.id }).from(s.mandates).where(eq(s.mandates.providerMandateId, r.mandateId))
      : r.customerId
        ? await tx.select({ id: s.mandates.id }).from(s.mandates).where(eq(s.mandates.providerCustomerId, r.customerId))
        : [];
    if (!existing.length) {
      await tx.insert(s.mandates).values({ clubId, householdId: setup.householdId, provider: setup.provider, providerMandateId: r.mandateId, providerCustomerId: r.customerId, status: "pending_submission" });
    }
    for (const sub of r.subscriptions) {
      await tx.insert(s.memberships).values({ clubId, studentId: sub.studentId, planId: sub.planId, startsOn: today, providerSubscriptionId: sub.subscriptionId, status: "active" });
    }
    const ids = r.subscriptions.map((x) => x.studentId);
    if (ids.length) await tx.update(s.students).set({ status: "active" }).where(and(inArray(s.students.id, ids), eq(s.students.status, "trial")));
    await tx.update(s.paymentSetups).set({ status: "completed", completedAt: new Date() }).where(eq(s.paymentSetups.id, setupId));
    await tx.insert(s.auditLog).values({ clubId, action: "create", entity: "payment_setup", entityId: setupId, after: { provider: setup.provider, students: ids.length } });
  });
}

type MandateStatus = (typeof s.mandateStatus.enumValues)[number];
type PaymentStatus = (typeof s.paymentStatus.enumValues)[number];

export async function updateMandate(clubId: string, match: { mandateId?: string | null; customerId?: string | null }, status: MandateStatus, setMandateId?: string) {
  await withClub({ clubId }, async (tx) => {
    // Stripe mandates are saved at checkout before Stripe tells us the mandate id, so a mandate id with no
    // match falls back to the customer's mandate that doesn't have an id yet.
    const byMandate = match.mandateId ? eq(s.mandates.providerMandateId, match.mandateId) : null;
    const byCustomer = match.customerId
      ? and(eq(s.mandates.providerCustomerId, match.customerId), match.mandateId ? isNull(s.mandates.providerMandateId) : undefined)
      : null;
    const where = byMandate && byCustomer ? or(byMandate, byCustomer) : (byMandate ?? byCustomer);
    if (!where) return;
    await tx.update(s.mandates).set({ status, ...(setMandateId ? { providerMandateId: setMandateId } : {}) }).where(where);
  });
}

/** Saves a payment (or its new status). Keyed on the provider's payment id, so repeats just update. */
export async function recordPayment(
  clubId: string,
  p: { providerPaymentId: string; mandateId?: string | null; customerId?: string | null; amountPence: number; chargeDate: string; status: PaymentStatus; description: string },
) {
  await withClub({ clubId }, async (tx) => {
    const where = p.mandateId ? eq(s.mandates.providerMandateId, p.mandateId) : p.customerId ? eq(s.mandates.providerCustomerId, p.customerId) : null;
    if (!where) return;
    const [m] = await tx.select({ id: s.mandates.id, householdId: s.mandates.householdId }).from(s.mandates).where(where);
    if (!m) return;
    const [existing] = await tx.select({ id: s.payments.id }).from(s.payments).where(eq(s.payments.providerPaymentId, p.providerPaymentId));
    if (existing) {
      await tx.update(s.payments).set({ status: p.status }).where(eq(s.payments.id, existing.id));
    } else {
      // Two deliveries at once: the second insert is skipped by the unique index and updates instead.
      const made = await tx.insert(s.payments).values({ clubId, householdId: m.householdId, mandateId: m.id, description: p.description, amountPence: p.amountPence, chargeDate: p.chargeDate, status: p.status, providerPaymentId: p.providerPaymentId }).onConflictDoNothing().returning({ id: s.payments.id });
      if (!made.length) await tx.update(s.payments).set({ status: p.status }).where(eq(s.payments.providerPaymentId, p.providerPaymentId));
    }
  });
}

export async function cancelMembership(clubId: string, subscriptionId: string) {
  await withClub({ clubId }, (tx) =>
    tx.update(s.memberships).set({ status: "cancelled", endsOn: new Date().toISOString().slice(0, 10) }).where(eq(s.memberships.providerSubscriptionId, subscriptionId)),
  );
}

/** What the sign-up link does about money: "debit" (prices and Direct Debit), "prices" (prices only) or "none". */
export async function signupPayments(actor: Actor): Promise<"debit" | "prices" | "none"> {
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const o = await joinPlans(tx);
    return !o ? "none" : o.provider ? "debit" : "prices";
  });
}
