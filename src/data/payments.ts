import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { decrypt, encrypt, verifyState, signState } from "@/lib/payments/crypto";
import { PROVIDERS, provider, type ConnectedAccount, type ProviderId, type SetupItem } from "@/lib/payments";
import type { Result } from "./accounts";

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
    const [account] = await tx.select({ provider: s.clubPaymentAccounts.provider, accountId: s.clubPaymentAccounts.accountId, connectedAt: s.clubPaymentAccounts.connectedAt }).from(s.clubPaymentAccounts);
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
    return {
      account: account ?? null,
      plans,
      mandates: Object.fromEntries(mandates.map((m) => [m.status, m.count])) as Record<string, number>,
      recent,
      available: { stripe: provider("stripe").available(), gocardless: provider("gocardless").available() },
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

/** Back from the provider: swap the code for the club's account and save it. */
export async function finishConnect(actor: Actor, id: string, code: string | null, state: string | null, redirectUri: string): Promise<Result<{ provider: ProviderId }>> {
  assertCan(actor, "club.manage");
  const pid = providerId.safeParse(id);
  const st = verifyState(state);
  if (!pid.success || !st || st.clubId !== actor.clubId || st.provider !== pid.data || !code) {
    return { ok: false, errors: { form: "That didn't work. Please try connecting again." } };
  }
  let acc: { accountId: string; accessToken?: string };
  try {
    acc = await provider(pid.data).completeConnect(code, redirectUri);
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
});

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
    tx.insert(s.plans).values({ clubId: actor.clubId, name: p.data.name, amountPence, interval: p.data.interval }).returning({ id: s.plans.id }),
  );
  return { ok: true, value: { id: row.id } };
}

/** Takes a price off the sign-up form. Families already paying it carry on. */
export async function archivePlan(actor: Actor, planId: string) {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(planId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.plans).set({ active: false }).where(eq(s.plans.id, planId)));
}

/* ---------- Sign-up link ---------- */

async function accountFor(tx: Tx): Promise<ConnectedAccount | null> {
  const [a] = await tx.select().from(s.clubPaymentAccounts);
  if (!a) return null;
  return { provider: a.provider as ProviderId, accountId: a.accountId, accessToken: a.accessTokenEnc ? decrypt(a.accessTokenEnc) : undefined };
}

/** What the public sign-up form needs to offer memberships. Null when the club isn't taking payments online. */
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
  input: { householdId: string; email: string; firstName: string; lastName: string; items: Array<{ studentId: string; planId: string }>; successUrl: (setupId: string) => string; cancelUrl: string },
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
    const [setup] = await tx
      .insert(s.paymentSetups)
      .values({ clubId, householdId: input.householdId, provider: account.provider, items: items.map((i) => ({ studentId: i.studentId, planId: i.planId })) })
      .returning({ id: s.paymentSetups.id });
    return { account, items, setupId: setup.id };
  });
  if (!prepared) return { ok: false, errors: { form: "Online payment isn't set up for this club." } };

  try {
    const r = await provider(prepared.account.provider).startSetup(prepared.account, {
      setupId: prepared.setupId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      items: prepared.items,
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
    const where = match.mandateId ? eq(s.mandates.providerMandateId, match.mandateId) : match.customerId ? eq(s.mandates.providerCustomerId, match.customerId) : null;
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
      await tx.insert(s.payments).values({ clubId, householdId: m.householdId, mandateId: m.id, description: p.description, amountPence: p.amountPence, chargeDate: p.chargeDate, status: p.status, providerPaymentId: p.providerPaymentId });
    }
  });
}

export async function cancelMembership(clubId: string, subscriptionId: string) {
  await withClub({ clubId }, (tx) =>
    tx.update(s.memberships).set({ status: "cancelled", endsOn: new Date().toISOString().slice(0, 10) }).where(eq(s.memberships.providerSubscriptionId, subscriptionId)),
  );
}

/** True when the sign-up link takes Direct Debit (provider connected and at least one price). */
export async function takesPaymentsAtSignup(actor: Actor): Promise<boolean> {
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => Boolean(await joinPaymentOptions(tx)));
}
