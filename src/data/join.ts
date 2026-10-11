import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, can, type Actor } from "@/auth/permissions";
import { disciplineName } from "@/lib/disciplines";
import { appUrl, sendEmail, templates } from "@/lib/email";
import type { FieldErrors, Result } from "./accounts";
import { joinPlans, startJoinPayment } from "./payments";
import { convertLeads } from "./leads";

/*
 * Family sign-up link: each club has one secret link (/join/<token>) that staff share or email.
 * Parents fill in their details and their children's, pick a membership, and join the club as members.
 * When the club takes Direct Debit, they go straight on to set it up with Stripe or GoCardless.
 */

export async function joinLink(actor: Actor): Promise<string> {
  assertCan(actor, "students.edit");
  const [c] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.select({ token: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, actor.clubId)),
  );
  return `${await appUrl()}/join/${c.token}`;
}

/** Makes a new link; the old one stops working. For when a link has been shared too widely. */
export async function resetJoinLink(actor: Actor): Promise<void> {
  assertCan(actor, "club.manage");
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.execute(sql`update clubs set join_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where id = ${actor.clubId}::uuid`);
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_join_link", entityId: actor.clubId });
  });
}

export async function sendJoinLink(actor: Actor, emailRaw: string): Promise<Result<{ email: string }>> {
  assertCan(actor, "students.edit");
  const e = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200).safeParse(emailRaw);
  if (!e.success) return { ok: false, errors: { email: e.error.issues[0].message } };
  const url = await joinLink(actor);
  const { clubName, inviter } = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const [me] = (await tx.execute(sql`select name from users where id = ${actor.userId}::uuid`)) as unknown as Array<{ name: string }>;
    return { clubName: club.name, inviter: me?.name ?? null };
  });
  const t = templates.joinInvite(clubName, inviter, url);
  await sendEmail({ to: e.data, ...t, template: "join-invite", clubId: actor.clubId });
  return { ok: true, value: { email: e.data } };
}

const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32,100}$/.test(t);

async function lookup(token: unknown): Promise<{ clubId: string; clubName: string } | null> {
  if (!tokenOk(token)) return null;
  const [r] = (await db().execute(sql`select * from join_club_lookup(${token})`)) as unknown as Array<{ club_id: string; club_name: string }>;
  return r ? { clubId: r.club_id, clubName: r.club_name } : null;
}

export type JoinForm = {
  clubName: string;
  sites: Array<{ id: string; name: string }>;
  arts: Array<{ id: string; name: string }>;
  /** The memberships to choose from (set when the club has prices). provider is set when they pay by Direct Debit straight away. */
  payment: { provider: "stripe" | "gocardless" | null; plans: Array<{ id: string; name: string; amountPence: number; interval: string }>; signupFeePence: number } | null;
};

/** What the public sign-up page needs. Null when the link is wrong or has been reset. */
export async function joinForm(token: unknown): Promise<JoinForm | null> {
  const club = await lookup(token);
  if (!club) return null;
  return withClub({ clubId: club.clubId }, async (tx) => {
    const sites = await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name));
    const arts = (
      await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)).orderBy(asc(s.clubDisciplines.createdAt))
    ).map((r) => ({ id: r.d, name: disciplineName(r.d) }));
    return { clubName: club.clubName, sites, arts, payment: await joinPlans(tx) };
  });
}

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const dob = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && v <= new Date().toISOString().slice(0, 10) && v >= "1920-01-01", "Enter their date of birth.");

export const MAX_CHILDREN = 6;

export const joinSchema = z
  .object({
    who: z.enum(["children", "me"]),
    parentFirstName: text(1, 80, "Enter your first name."),
    parentLastName: text(1, 80, "Enter your last name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    phone: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a phone number we can reach you on."),
    myDateOfBirth: z.string().optional(),
    mySiteId: z.string().optional(),
    myMedical: z.string().trim().max(2000).optional(),
    myPlanId: z.string().optional(),
    children: z
      .array(
        z.object({
          firstName: text(1, 80, "Enter their first name."),
          lastName: z.string().trim().max(80).optional(),
          dateOfBirth: dob,
          siteId: z.string(),
          medical: z.string().trim().max(2000).optional(),
          planId: z.string().optional(),
        }),
      )
      .max(MAX_CHILDREN),
    firstAidConsent: z.boolean(),
    photoConsent: z.boolean(),
    terms: z.boolean().refine((v) => v, "Please tick to confirm."),
  })
  .superRefine((d, ctx) => {
    if (d.who === "children" && d.children.length === 0) ctx.addIssue({ code: "custom", path: ["children"], message: "Add at least one child." });
    if (d.who === "me" && !dob.safeParse(d.myDateOfBirth ?? "").success) ctx.addIssue({ code: "custom", path: ["myDateOfBirth"], message: "Enter your date of birth." });
  });

export type JoinInput = z.input<typeof joinSchema>;

function joinErrors(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) {
    const key = i.path[0] === "children" && typeof i.path[1] === "number" ? `children.${i.path[1]}.${String(i.path[2] ?? "")}` : String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

/** Saves a family sign-up. Everyone joins as a member on the membership they picked. */
export async function submitJoin(
  token: unknown,
  input: JoinInput,
  urls?: { success: (setupId: string) => string; cancel: string },
): Promise<Result<{ clubName: string; names: string[]; paymentUrl: string | null; paymentError?: string }>> {
  const club = await lookup(token);
  if (!club) return { ok: false, errors: { form: "This sign-up link has changed. Ask the club for the new one." } };
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: joinErrors(parsed.error) };
  const d = parsed.data;

  const out = await withClub({ clubId: club.clubId }, async (tx) => {
    const sites = new Set((await tx.select({ id: s.sites.id }).from(s.sites)).map((x) => x.id));
    const firstSite = [...sites][0];
    if (!firstSite) return { error: { form: "This club isn't taking sign-ups yet." } as FieldErrors };

    // When the club has prices, everyone picks a membership.
    const payment = await joinPlans(tx);
    const planOk = (id?: string) => !!id && !!payment?.plans.some((p) => p.id === id);
    if (payment) {
      const errs: FieldErrors = {};
      if (d.who === "me" && !planOk(d.myPlanId)) errs.myPlanId = "Choose a membership.";
      if (d.who === "children") d.children.forEach((c, i) => { if (!planOk(c.planId)) errs[`children.${i}.planId`] = "Choose a membership."; });
      if (Object.keys(errs).length) return { error: errs };
    }

    const people =
      d.who === "me"
        ? [{ firstName: d.parentFirstName, lastName: d.parentLastName, dateOfBirth: d.myDateOfBirth!, siteId: d.mySiteId ?? "", medical: d.myMedical, planId: d.myPlanId }]
        : d.children.map((c) => ({ ...c, lastName: c.lastName || d.parentLastName }));

    // Join an existing family when the club already has this parent's email.
    const [existing] = (await tx.execute(
      sql`select household_id from guardians where lower(email) = ${d.email} order by created_at limit 1`,
    )) as unknown as Array<{ household_id: string }>;
    let householdId = existing?.household_id;
    if (!householdId) {
      const [h] = await tx.insert(s.households).values({ clubId: club.clubId, name: `${d.parentLastName} family` }).returning({ id: s.households.id });
      householdId = h.id;
      await tx.insert(s.guardians).values({
        clubId: club.clubId,
        householdId,
        firstName: d.parentFirstName,
        lastName: d.parentLastName,
        email: d.email,
        phone: d.phone,
        relationship: d.who === "me" ? "self" : "parent",
        isPayer: true,
      });
    }

    const already = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, dateOfBirth: s.students.dateOfBirth })
      .from(s.students)
      .where(eq(s.students.householdId, householdId));
    const key = (p: { firstName: string; lastName: string; dateOfBirth: string | null }) => `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}|${p.dateOfBirth ?? ""}`;
    const have = new Map(already.map((x) => [key(x), x.id]));

    const names: string[] = [];
    const items: Array<{ studentId: string; planId: string }> = [];
    const today = new Date().toISOString().slice(0, 10);
    // Without Direct Debit, the membership starts now and the club collects payment its own way.
    const addMembership = async (studentId: string, planId?: string) => {
      if (!payment || !planId) return;
      const [has] = await tx.select({ id: s.memberships.id }).from(s.memberships).where(and(eq(s.memberships.studentId, studentId), eq(s.memberships.status, "active"))).limit(1);
      if (has) return;
      if (payment.provider) return void items.push({ studentId, planId });
      await tx.insert(s.memberships).values({ clubId: club.clubId, studentId, planId, startsOn: today, status: "active" });
    };
    for (const p of people) {
      const known = have.get(key(p));
      if (known) {
        names.push(p.firstName);
        await addMembership(known, p.planId);
        continue;
      }
      const [st] = await tx
        .insert(s.students)
        .values({
          clubId: club.clubId,
          householdId,
          siteId: sites.has(p.siteId) ? p.siteId : firstSite,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          status: "active",
          medicalNotes: p.medical || null,
          firstAidConsent: d.firstAidConsent,
          photoConsent: d.photoConsent,
          source: "join_link",
        })
        .returning({ id: s.students.id });
      have.set(key(p), st.id);
      await tx.insert(s.auditLog).values({ clubId: club.clubId, action: "create", entity: "student", entityId: st.id, after: { via: "join_link" } });
      names.push(p.firstName);
      await addMembership(st.id, p.planId);
    }

    // Anyone who was a lead (same email or phone) now shows as converted.
    const firstId = have.get(key(people[0]));
    if (firstId) await convertLeads(tx, club.clubId, { email: d.email, phone: d.phone, studentId: firstId });

    const notify = (await tx.execute(
      sql`select u.email from club_staff cs join users u on u.id = cs.user_id where cs.role in ('owner', 'admin')`,
    )) as unknown as Array<{ email: string }>;
    return { names, items, householdId, notify: notify.map((n) => n.email) };
  });
  if ("error" in out) return { ok: false, errors: out.error! };

  const url = await appUrl();
  const parentName = `${d.parentFirstName} ${d.parentLastName}`;
  const confirm = templates.joinConfirm(parentName, club.clubName, out.names);
  const alert = templates.newSignup(club.clubName, parentName, out.names, `${url}/students`);
  // Never let email trouble undo a sign-up.
  await Promise.allSettled([
    sendEmail({ to: d.email, ...confirm, template: "join-confirm", clubId: club.clubId }),
    ...out.notify.map((to) => sendEmail({ to, ...alert, template: "new-signup", clubId: club.clubId })),
  ]);

  // Hand over to Stripe or GoCardless to set up the Direct Debit.
  let paymentUrl: string | null = null;
  let paymentError: string | undefined;
  if (out.items.length && urls) {
    const r = await startJoinPayment(club.clubId, {
      householdId: out.householdId,
      email: d.email,
      firstName: d.parentFirstName,
      lastName: d.parentLastName,
      items: out.items,
      successUrl: urls.success,
      cancelUrl: urls.cancel,
    });
    if (r.ok) paymentUrl = r.value.url;
    else paymentError = r.errors.form;
  }
  return { ok: true, value: { clubName: club.clubName, names: out.names, paymentUrl, paymentError } };
}

/** Students who signed up through the link in the last 14 days, newest first, for the Today page. */
export async function recentSignups(actor: Actor) {
  if (!can(actor, "students.view")) return [];
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, siteId: s.students.siteId, site: s.sites.name, createdAt: s.students.createdAt })
      .from(s.students)
      .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
      .where(and(eq(s.students.source, "join_link"), gt(s.students.createdAt, new Date(Date.now() - 14 * 86_400_000))))
      .orderBy(desc(s.students.createdAt))
      .limit(20);
    return rows.filter((r) => actor.sites === "all" || actor.sites.includes(r.siteId)).slice(0, 8);
  });
}

/** For the page parents land on after Stripe or GoCardless. */
export async function joinSetupStatus(token: unknown, setupId: string) {
  const club = await lookup(token);
  if (!club) return null;
  const { setupStatus } = await import("./payments");
  const st = await setupStatus(club.clubId, setupId);
  return st ? { clubName: club.clubName, ...st } : null;
}
