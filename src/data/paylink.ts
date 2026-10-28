import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { signLink, verifyLink } from "@/lib/payments/crypto";
import { appUrl, sendEmail, templates } from "@/lib/email";
import type { Result } from "./accounts";
import { joinPlans, startJoinPayment } from "./payments";

/*
 * "Send plan and payment link": for a family that signed up but didn't finish (or anyone not on a plan yet).
 * Staff send it from a student's profile. The family opens /pay/<token>, chooses a membership for each child
 * who isn't on one, and goes on to set up Direct Debit. They become members once it's set up.
 */

const TTL_DAYS = 14;
type Claims = { c: string; h: string };

/** Students in the family who can be put on a membership: not left, and not already on one. */
async function unpaid(tx: Tx, householdId: string) {
  return tx
    .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, status: s.students.status })
    .from(s.students)
    .where(
      and(
        eq(s.students.householdId, householdId),
        ne(s.students.status, "cancelled"),
        sql`not exists (select 1 from memberships m where m.student_id = ${s.students.id} and m.status = 'active' and (m.ends_on is null or m.ends_on >= current_date))`,
      ),
    )
    .orderBy(s.students.firstName);
}

/** Whether the profile shows the button: the club takes Direct Debit, this student isn't on a plan, and the family has an email. */
export async function canSendPayLink(actor: Actor, studentId: string): Promise<boolean> {
  try {
    assertCan(actor, "payments.manage");
  } catch {
    return false;
  }
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const options = await joinPlans(tx);
    if (!options?.provider) return false;
    const [st] = await tx.select({ householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || (actor.sites !== "all" && !actor.sites.includes(st.siteId))) return false;
    if (!(await unpaid(tx, st.householdId)).some((x) => x.id === studentId)) return false;
    const [g] = await tx.select({ email: s.guardians.email }).from(s.guardians).where(and(eq(s.guardians.householdId, st.householdId), sql`${s.guardians.email} is not null`)).limit(1);
    return Boolean(g?.email);
  });
}

export async function sendPayLink(actor: Actor, studentId: string): Promise<Result<{ email: string }>> {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(studentId).success) return { ok: false, errors: { form: "Student not found." } };
  const found = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [st] = await tx.select({ id: s.students.id, householdId: s.students.householdId, siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || (actor.sites !== "all" && !actor.sites.includes(st.siteId))) return { error: "Student not found." };
    const options = await joinPlans(tx);
    if (!options?.provider) return { error: "Connect Stripe or GoCardless and add prices shown on your sign-up form first." };
    const people = await unpaid(tx, st.householdId);
    if (!people.some((x) => x.id === st.id)) return { error: "They're already on a membership." };
    const [payer] = await tx
      .select({ firstName: s.guardians.firstName, lastName: s.guardians.lastName, email: s.guardians.email })
      .from(s.guardians)
      .where(and(eq(s.guardians.householdId, st.householdId), sql`${s.guardians.email} is not null`))
      .orderBy(desc(s.guardians.isPayer), s.guardians.createdAt)
      .limit(1);
    if (!payer?.email) return { error: "Add an email for the family first." };
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "payment_link", entityId: st.id, after: { to: payer.email } });
    return { householdId: st.householdId, payer: { ...payer, email: payer.email }, clubName: club.name, names: people.map((x) => x.firstName) };
  });
  if ("error" in found) return { ok: false, errors: { form: found.error! } };
  const token = signLink<Claims>("pay", { c: actor.clubId, h: found.householdId }, TTL_DAYS * 86_400);
  const url = `${await appUrl()}/pay/${token}`;
  const t = templates.choosePlanLink(`${found.payer.firstName} ${found.payer.lastName}`, found.clubName, found.names, url);
  await sendEmail({ to: found.payer.email, ...t, template: "choose-plan-link", clubId: actor.clubId });
  return { ok: true, value: { email: found.payer.email } };
}

export type PayPage = {
  clubName: string;
  people: Array<{ id: string; name: string; suggestedPlanId: string | null }>;
  plans: Array<{ id: string; name: string; amountPence: number; interval: string }>;
  provider: "stripe" | "gocardless";
  signupFeePence: number;
};

/** What the public page needs. Null when the link is wrong or out of date, or there's nothing left to pay for. */
export async function payPage(token: unknown): Promise<PayPage | null> {
  const claims = verifyLink<Claims>("pay", token);
  if (!claims) return null;
  return withClub({ clubId: claims.c }, async (tx) => {
    const options = await joinPlans(tx);
    if (!options?.provider) return null;
    const people = await unpaid(tx, claims.h);
    if (!people.length) return null;
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, claims.c));
    // Whatever they picked when they signed up, so they don't have to choose again.
    const setups = await tx.select({ items: s.paymentSetups.items }).from(s.paymentSetups).where(eq(s.paymentSetups.householdId, claims.h)).orderBy(desc(s.paymentSetups.createdAt)).limit(10);
    const picked = new Map<string, string>();
    for (const x of setups) for (const i of x.items as Array<{ studentId: string; planId: string }>) if (!picked.has(i.studentId)) picked.set(i.studentId, i.planId);
    const planIds = new Set(options.plans.map((p) => p.id));
    return {
      clubName: club.name,
      people: people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, suggestedPlanId: planIds.has(picked.get(p.id) ?? "") ? picked.get(p.id)! : null })),
      plans: options.plans,
      provider: options.provider,
      // The sign-up fee is for people who never finished signing up, not for existing students.
      signupFeePence: people.some((p) => p.status === "pending") ? options.signupFeePence : 0,
    };
  });
}

/** The family's choices. Returns the Stripe or GoCardless page to send them to. */
export async function submitPay(token: unknown, choices: Record<string, string>): Promise<Result<{ url: string }>> {
  const claims = verifyLink<Claims>("pay", token);
  if (!claims) return { ok: false, errors: { form: "This link has run out. Ask the club for a new one." } };
  const prepared = await withClub({ clubId: claims.c }, async (tx) => {
    const options = await joinPlans(tx);
    if (!options?.provider) return { error: { form: "The club isn't taking Direct Debit online just now. Please contact them." } };
    const people = await unpaid(tx, claims.h);
    const planIds = new Set(options.plans.map((p) => p.id));
    const errors: Record<string, string> = {};
    const items: Array<{ studentId: string; planId: string }> = [];
    for (const p of people) {
      const planId = choices[p.id] ?? "";
      if (planId === "none") continue;
      if (!planIds.has(planId)) errors[p.id] = "Choose a membership.";
      else items.push({ studentId: p.id, planId });
    }
    if (Object.keys(errors).length) return { error: errors };
    if (!items.length) return { error: { form: "Choose a membership for at least one person." } };
    const [payer] = await tx
      .select({ firstName: s.guardians.firstName, lastName: s.guardians.lastName, email: s.guardians.email })
      .from(s.guardians)
      .where(and(eq(s.guardians.householdId, claims.h), sql`${s.guardians.email} is not null`))
      .orderBy(desc(s.guardians.isPayer), s.guardians.createdAt)
      .limit(1);
    if (!payer?.email) return { error: { form: "The club needs your email first. Please contact them." } };
    const [club] = await tx.select({ token: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, claims.c));
    const chosen = people.filter((p) => items.some((i) => i.studentId === p.id));
    return { items, payer: { ...payer, email: payer.email }, joinToken: club.token, withSignupFee: chosen.every((p) => p.status === "pending") };
  });
  if ("error" in prepared) return { ok: false, errors: prepared.error! };
  const base = await appUrl();
  const r = await startJoinPayment(claims.c, {
    householdId: claims.h,
    email: prepared.payer.email,
    firstName: prepared.payer.firstName,
    lastName: prepared.payer.lastName,
    items: prepared.items,
    successUrl: (id) => `${base}/join/${prepared.joinToken}/done?setup=${id}`,
    cancelUrl: `${base}/join/${prepared.joinToken}/done?cancelled=1`,
    withSignupFee: prepared.withSignupFee,
  });
  if (!r.ok) return { ok: false, errors: { form: "We couldn't open the Direct Debit page just now. Please try again in a minute." } };
  return { ok: true, value: { url: r.value.url } };
}
