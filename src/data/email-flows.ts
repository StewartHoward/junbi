import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { hashPassword, passwordProblem } from "@/auth/password";
import { assertCan, can, type Actor } from "@/auth/permissions";
import { appUrl, sendEmail, templates } from "@/lib/email";
import { checkLogin, type Result } from "./accounts";

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const tokenOk = (t: unknown): t is string => typeof t === "string" && t.length > 20 && t.length < 100;

/* ---------- Welcome ---------- */

export async function sendWelcome(w: { userId: string; clubId: string; name: string; email: string; clubName: string }) {
  const t = templates.welcome(w.name, w.clubName, await appUrl());
  await sendEmail({ to: w.email.trim().toLowerCase(), ...t, template: "welcome", clubId: w.clubId, dedupeKey: `welcome:${w.userId}:${w.clubId}` });
}

/* ---------- Password reset ---------- */

/** Always succeeds from the caller's point of view, so nobody can find out which emails have accounts. */
export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return;
  const token = newToken();
  const rows = (await db().execute(
    sql`select * from auth_reset_create(${email}, ${hashToken(token)}, ${new Date(Date.now() + 3_600_000).toISOString()}::timestamptz)`,
  )) as unknown as Array<{ user_id: string; name: string }>;
  const u = rows[0];
  if (!u) return;
  const t = templates.passwordReset(u.name, `${await appUrl()}/reset-password?token=${token}`);
  await sendEmail({ to: email, ...t, template: "password-reset" });
}

export async function resetLinkValid(token: unknown): Promise<boolean> {
  if (!tokenOk(token)) return false;
  const [r] = (await db().execute(sql`select auth_reset_valid(${hashToken(token)}) as ok`)) as unknown as Array<{ ok: boolean }>;
  return Boolean(r?.ok);
}

export async function resetPassword(token: unknown, password: string): Promise<Result<{ userId: string }>> {
  if (!tokenOk(token)) return { ok: false, errors: { form: "This link has expired. Ask for a new one." } };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, errors: { password: problem } };
  const [r] = (await db().execute(
    sql`select auth_reset_use(${hashToken(token)}, ${await hashPassword(password)}) as id`,
  )) as unknown as Array<{ id: string | null }>;
  if (!r?.id) return { ok: false, errors: { form: "This link has expired or been used. Ask for a new one." } };
  return { ok: true, value: { userId: r.id } };
}

/* ---------- Staff invites ---------- */

export const STAFF_ROLES = ["admin", "instructor", "assistant"] as const;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  role: z.enum(STAFF_ROLES, { message: "Choose a role." }),
  siteIds: z.array(z.string().uuid()).default([]),
});

export async function inviteStaff(actor: Actor, input: z.input<typeof inviteSchema>): Promise<Result<{ sent: boolean }>> {
  assertCan(actor, "staff.manage");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  if (d.role === "admin" && actor.role !== "owner") return { ok: false, errors: { role: "Only the owner can invite admins." } };

  const token = newToken();
  const out = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const sites = await tx.select({ id: s.sites.id }).from(s.sites);
    const allowed = new Set(sites.map((x) => x.id).filter((id) => actor.sites === "all" || actor.sites.includes(id)));
    const allSites = d.role === "admin";
    const siteIds = allSites ? [] : d.siteIds.filter((id) => allowed.has(id));
    if (!allSites && siteIds.length === 0) return { error: { siteIds: "Choose at least one site." } };

    const existing = await tx.execute(
      sql`select 1 from club_staff cs join users u on u.id = cs.user_id where u.email = ${d.email} limit 1`,
    );
    if ((existing as unknown as unknown[]).length) return { error: { email: "This person is already on your staff." } };

    // Replace any earlier invite to the same email.
    await tx.delete(s.staffInvites).where(and(eq(s.staffInvites.email, d.email), isNull(s.staffInvites.acceptedAt)));
    await tx.insert(s.staffInvites).values({
      clubId: actor.clubId,
      email: d.email,
      role: d.role,
      allSites,
      siteIds,
      tokenHash: hashToken(token),
      invitedBy: actor.userId,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const [me] = (await tx.execute(sql`select name from users where id = ${actor.userId}::uuid`)) as unknown as Array<{ name: string }>;
    return { clubName: club.name, inviter: me?.name ?? null };
  });
  if ("error" in out) return { ok: false, errors: out.error as unknown as Record<string, string> };

  const t = templates.staffInvite(out.clubName, out.inviter, d.role, `${await appUrl()}/invite?token=${token}`);
  const r = await sendEmail({ to: d.email, ...t, template: "staff-invite", clubId: actor.clubId });
  return { ok: true, value: { sent: r.status === "sent" || r.status === "logged" } };
}

export async function listPendingInvites(actor: Actor) {
  if (!can(actor, "staff.manage")) return [];
  return withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx
      .select({ id: s.staffInvites.id, email: s.staffInvites.email, role: s.staffInvites.role, expiresAt: s.staffInvites.expiresAt })
      .from(s.staffInvites)
      .where(and(isNull(s.staffInvites.acceptedAt), gt(s.staffInvites.expiresAt, new Date())))
      .orderBy(s.staffInvites.createdAt),
  );
}

export async function cancelInvite(actor: Actor, inviteId: string) {
  assertCan(actor, "staff.manage");
  if (!z.string().uuid().safeParse(inviteId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.delete(s.staffInvites).where(eq(s.staffInvites.id, inviteId)));
}

/** Removes a member of staff from this club. The owner can't be removed, and you can't remove yourself. */
export async function removeStaff(actor: Actor, staffId: string): Promise<Result> {
  assertCan(actor, "staff.manage");
  if (!z.string().uuid().safeParse(staffId).success) return { ok: false, errors: { form: "Not found." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [m] = await tx.select().from(s.clubStaff).where(eq(s.clubStaff.id, staffId));
    if (!m) return { ok: false as const, errors: { form: "Not found." } };
    if (m.role === "owner" || m.userId === actor.userId) return { ok: false as const, errors: { form: "You can't remove the owner or yourself." } };
    if (m.role === "admin" && actor.role !== "owner") return { ok: false as const, errors: { form: "Only the owner can remove admins." } };
    await tx.delete(s.clubStaff).where(eq(s.clubStaff.id, staffId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "delete", entity: "club_staff", entityId: staffId, before: { userId: m.userId, role: m.role } });
    return { ok: true as const, value: undefined };
  });
}

export type InviteDetails = { clubName: string; email: string; role: string; inviterName: string | null; userExists: boolean };

export async function lookupInvite(token: unknown): Promise<InviteDetails | null> {
  if (!tokenOk(token)) return null;
  const [r] = (await db().execute(sql`select * from invite_lookup(${hashToken(token)})`)) as unknown as Array<{
    club_name: string;
    email: string;
    role: string;
    inviter_name: string | null;
    user_exists: boolean;
  }>;
  return r ? { clubName: r.club_name, email: r.email, role: r.role, inviterName: r.inviter_name, userExists: r.user_exists } : null;
}

/** Accept as someone new to Junbi: creates their login, then joins the club. */
export async function acceptInviteAsNewUser(token: unknown, name: string, password: string): Promise<Result<{ userId: string }>> {
  const inv = await lookupInvite(token);
  if (!inv || !tokenOk(token)) return { ok: false, errors: { form: "This invitation has expired. Ask for a new one." } };
  if (inv.userExists) return { ok: false, errors: { form: "You already have a Junbi login. Sign in below to accept." } };
  const n = z.string().trim().min(2, "Please enter your name.").max(120).safeParse(name);
  if (!n.success) return { ok: false, errors: { name: n.error.issues[0].message } };
  const problem = passwordProblem(password, inv.email);
  if (problem) return { ok: false, errors: { password: problem } };
  const passwordHash = await hashPassword(password);

  const userId = await db().transaction(async (tx) => {
    const [u] = (await tx.execute(sql`select auth_create_user(${inv.email}, ${n.data}, ${passwordHash}) as id`)) as unknown as Array<{ id: string | null }>;
    if (!u?.id) return null;
    const [c] = (await tx.execute(sql`select invite_accept(${hashToken(token)}, ${u.id}::uuid) as club`)) as unknown as Array<{ club: string | null }>;
    if (!c?.club) throw new Error("invite could not be accepted");
    return u.id;
  });
  if (!userId) return { ok: false, errors: { form: "You already have a Junbi login. Sign in below to accept." } };
  return { ok: true, value: { userId } };
}

/** Accept as someone who already has a Junbi login: checks their password, then joins the club. */
export async function acceptInviteAsExistingUser(token: unknown, password: string): Promise<Result<{ userId: string }>> {
  const inv = await lookupInvite(token);
  if (!inv || !tokenOk(token)) return { ok: false, errors: { form: "This invitation has expired. Ask for a new one." } };
  const login = await checkLogin(inv.email, password);
  if (!login.ok) return login;
  const [c] = (await db().execute(sql`select invite_accept(${hashToken(token)}, ${login.value.userId}::uuid) as club`)) as unknown as Array<{ club: string | null }>;
  if (!c?.club) return { ok: false, errors: { form: "This invitation has expired. Ask for a new one." } };
  return { ok: true, value: { userId: login.value.userId } };
}

/* ---------- Trial reminders ---------- */

export async function sendTrialReminders() {
  const rows = (await db().execute(sql`select * from trial_reminders_due()`)) as unknown as Array<{
    club_id: string;
    club_name: string;
    trial_ends_on: string;
    days_left: number;
    owner_email: string;
    owner_name: string;
  }>;
  const url = await appUrl();
  let sent = 0;
  for (const r of rows) {
    const endsOn = typeof r.trial_ends_on === "string" ? r.trial_ends_on.slice(0, 10) : new Date(r.trial_ends_on).toISOString().slice(0, 10);
    const t = templates.trialReminder(r.owner_name, r.club_name, r.days_left, endsOn, url);
    const res = await sendEmail({
      to: r.owner_email,
      ...t,
      template: `trial-${r.days_left}`,
      clubId: r.club_id,
      dedupeKey: `trial-${r.days_left}:${r.club_id}:${endsOn}:${r.owner_email}`,
    });
    if (res.status === "sent" || res.status === "logged") sent++;
  }
  return { due: rows.length, sent };
}
