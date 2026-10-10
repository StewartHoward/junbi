import "server-only";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, ForbiddenError, type Actor } from "@/auth/permissions";
import { sendBatch, templates } from "@/lib/email";
import type { FieldErrors, Result } from "./accounts";

/*
 * Messages to parents: staff pick who it goes to (everyone, a site, or a class), write it, and send.
 * Email goes out through Resend with the club's name as the sender and the staff member as reply-to.
 * Recipients are family contacts (guardians) of current students (Active or Trial), one email per address.
 */

export const MAX_RECIPIENTS = 2000;
/** "A class" means students who've been to it recently, as there's no fixed class list. */
export const CLASS_LOOKBACK_DAYS = 56;
const WEEKDAYS = ["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

export const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("site"), siteId: z.string().uuid() }),
  z.object({ kind: z.literal("class"), classId: z.string().uuid() }),
]);
export type Audience = z.infer<typeof audienceSchema>;

const covers = (actor: Actor, siteId: string) => actor.sites === "all" || actor.sites.includes(siteId);

export async function messageOptions(actor: Actor) {
  assertCan(actor, "messages.send");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const sites = (await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name))).filter((x) => covers(actor, x.id));
    const classes = (
      await tx
        .select({ id: s.classes.id, name: s.classes.name, siteId: s.classes.siteId, site: s.sites.name, weekday: s.classes.weekday, startsAt: s.classes.startsAt })
        .from(s.classes)
        .innerJoin(s.sites, eq(s.sites.id, s.classes.siteId))
        .where(eq(s.classes.archived, false))
        .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt))
    )
      .filter((c) => covers(actor, c.siteId))
      .map((c) => ({ id: c.id, label: `${c.name} · ${WEEKDAYS[c.weekday]} ${c.startsAt.slice(0, 5)}${sites.length > 1 ? ` · ${c.site}` : ""}` }));
    return { sites, classes, allSites: actor.sites === "all" };
  });
}

type Resolved = {
  label: string;
  students: number;
  families: number;
  recipients: Array<{ guardianId: string; name: string; email: string }>;
  familiesWithoutEmail: number;
};

async function resolveAudience(tx: Tx, actor: Actor, audience: Audience): Promise<Resolved> {
  const siteRows = await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites);
  const mySites = siteRows.filter((x) => covers(actor, x.id));
  let siteIds = mySites.map((x) => x.id);
  let label = actor.sites === "all" ? "Everyone" : `Everyone at ${mySites.map((x) => x.name).join(" and ")}`;
  let studentFilter: string[] | null = null;

  if (audience.kind === "site") {
    const site = mySites.find((x) => x.id === audience.siteId);
    if (!site) throw new ForbiddenError("messages.send");
    siteIds = [site.id];
    label = `Everyone at ${site.name}`;
  } else if (audience.kind === "class") {
    const [c] = await tx.select().from(s.classes).where(eq(s.classes.id, audience.classId));
    if (!c || !covers(actor, c.siteId)) throw new ForbiddenError("messages.send");
    const site = siteRows.find((x) => x.id === c.siteId);
    label = `${c.name} · ${WEEKDAYS[c.weekday]} ${c.startsAt.slice(0, 5)}${siteRows.length > 1 && site ? ` · ${site.name}` : ""}`;
    siteIds = [c.siteId];
    const since = new Date(Date.now() - CLASS_LOOKBACK_DAYS * 86_400_000);
    const rows = await tx
      .selectDistinct({ studentId: s.attendance.studentId })
      .from(s.attendance)
      .innerJoin(s.sessions, eq(s.sessions.id, s.attendance.sessionId))
      .where(and(eq(s.sessions.classId, c.id), gt(s.sessions.startsAt, since)));
    studentFilter = rows.map((r) => r.studentId);
  }

  if (!siteIds.length || (studentFilter && !studentFilter.length)) return { label, students: 0, families: 0, recipients: [], familiesWithoutEmail: 0 };

  const students = await tx
    .select({ id: s.students.id, householdId: s.students.householdId })
    .from(s.students)
    .where(
      and(
        inArray(s.students.siteId, siteIds),
        inArray(s.students.status, ["active", "trial"]),
        studentFilter ? inArray(s.students.id, studentFilter) : undefined,
      ),
    );
  const households = [...new Set(students.map((x) => x.householdId))];
  if (!households.length) return { label, students: 0, families: 0, recipients: [], familiesWithoutEmail: 0 };

  const guardians = await tx
    .select({ id: s.guardians.id, householdId: s.guardians.householdId, firstName: s.guardians.firstName, lastName: s.guardians.lastName, email: s.guardians.email })
    .from(s.guardians)
    .where(inArray(s.guardians.householdId, households))
    .orderBy(desc(s.guardians.isPayer), asc(s.guardians.createdAt));

  const seen = new Set<string>();
  const reached = new Set<string>();
  const recipients: Resolved["recipients"] = [];
  for (const g of guardians) {
    const email = g.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    reached.add(g.householdId);
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ guardianId: g.id, name: `${g.firstName} ${g.lastName}`.trim(), email });
  }
  return { label, students: students.length, families: households.length, recipients, familiesWithoutEmail: households.length - reached.size };
}

export type AudiencePreview = Omit<Resolved, "recipients"> & { emails: number };

/** How many families a message would reach, without sending anything. */
export async function previewAudience(actor: Actor, audienceIn: unknown): Promise<Result<AudiencePreview>> {
  assertCan(actor, "messages.send");
  const a = audienceSchema.safeParse(audienceIn);
  if (!a.success) return { ok: false, errors: { audience: "Choose who it's for." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const r = await resolveAudience(tx, actor, a.data);
    const { recipients, ...rest } = r;
    return { ok: true as const, value: { ...rest, emails: recipients.length } };
  });
}

const composeSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(1, "Write your message.").max(10_000, "That's too long for one message."),
});

/** Sends a message now. Returns the message id once every email has been handed to the provider. */
export async function sendMessage(actor: Actor, input: { audience: unknown; subject: string; body: string }): Promise<Result<{ id: string; sent: number; failed: number }>> {
  assertCan(actor, "messages.send");
  const a = audienceSchema.safeParse(input.audience);
  const c = composeSchema.safeParse(input);
  const errors: FieldErrors = {};
  if (!a.success) errors.audience = "Choose who it's for.";
  if (!c.success) for (const i of c.error.issues) errors[String(i.path[0])] ??= i.message;
  if (!a.success || !c.success) return { ok: false, errors };

  const prepared = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const r = await resolveAudience(tx, actor, a.data);
    if (!r.recipients.length) return { error: { audience: r.families ? "None of these families have an email address yet." : "There's nobody to send this to." } as FieldErrors };
    if (r.recipients.length > MAX_RECIPIENTS) return { error: { audience: `That's more than ${MAX_RECIPIENTS} people. Pick a site or class.` } as FieldErrors };
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const [me] = (await tx.execute(sql`select name, email from users where id = ${actor.userId}::uuid`)) as unknown as Array<{ name: string; email: string }>;
    const [m] = await tx
      .insert(s.messages)
      .values({
        clubId: actor.clubId,
        senderUserId: actor.userId,
        channel: "email",
        audience: a.data,
        audienceLabel: r.label,
        subject: c.data.subject,
        body: c.data.body,
        recipientCount: r.recipients.length,
      })
      .returning({ id: s.messages.id });
    const rows = await tx
      .insert(s.messageRecipients)
      .values(r.recipients.map((x) => ({ clubId: actor.clubId, messageId: m.id, guardianId: x.guardianId, name: x.name, email: x.email })))
      .returning({ id: s.messageRecipients.id, email: s.messageRecipients.email });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "message", entityId: m.id, after: { audience: r.label, recipients: r.recipients.length } });
    return { id: m.id, rows, clubName: club.name, sender: me };
  });
  if ("error" in prepared) return { ok: false, errors: prepared.error! };

  const t = templates.clubMessage(prepared.clubName, prepared.sender?.name ?? null, c.data.subject, c.data.body);
  const results = await sendBatch(
    prepared.rows.map((r) => ({ to: r.email!, subject: t.subject, html: t.html, text: t.text, fromName: prepared.clubName, replyTo: prepared.sender?.email })),
  );

  const sent = results.filter((x) => x.status !== "failed").length;
  const failed = results.length - sent;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    // Group updates by outcome to keep this to a few statements.
    const byStatus = new Map<string, string[]>();
    prepared.rows.forEach((row, i) => {
      const k = results[i].status;
      byStatus.set(k, [...(byStatus.get(k) ?? []), row.id]);
    });
    for (const [status, ids] of byStatus) {
      const err = status === "failed" ? results.find((x) => x.status === "failed")?.error ?? null : null;
      await tx.update(s.messageRecipients).set({ status, error: err }).where(inArray(s.messageRecipients.id, ids));
    }
    const withIds = prepared.rows.map((row, i) => ({ id: row.id, providerId: results[i].providerId })).filter((x) => x.providerId);
    for (const x of withIds) await tx.update(s.messageRecipients).set({ providerId: x.providerId! }).where(eq(s.messageRecipients.id, x.id));
    await tx.update(s.messages).set({ sentCount: sent, failedCount: failed }).where(eq(s.messages.id, prepared.id));
  });
  return { ok: true, value: { id: prepared.id, sent, failed } };
}

/** Recent messages. Staff who only cover some sites see the ones they sent. */
export async function listMessages(actor: Actor) {
  assertCan(actor, "messages.send");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({
        id: s.messages.id,
        subject: s.messages.subject,
        audienceLabel: s.messages.audienceLabel,
        recipientCount: s.messages.recipientCount,
        failedCount: s.messages.failedCount,
        createdAt: s.messages.createdAt,
        senderUserId: s.messages.senderUserId,
        sender: sql<string | null>`(select name from users u where u.id = ${s.messages.senderUserId})`,
      })
      .from(s.messages)
      .orderBy(desc(s.messages.createdAt))
      .limit(100);
    return rows.filter((r) => actor.sites === "all" || r.senderUserId === actor.userId);
  });
}

export async function getMessage(actor: Actor, id: string) {
  assertCan(actor, "messages.send");
  if (!z.string().uuid().safeParse(id).success) return null;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [m] = await tx.select().from(s.messages).where(eq(s.messages.id, id));
    if (!m || (actor.sites !== "all" && m.senderUserId !== actor.userId)) return null;
    const [sender] = (await tx.execute(sql`select name from users where id = ${m.senderUserId}::uuid`)) as unknown as Array<{ name: string }>;
    const recipients = await tx
      .select({ name: s.messageRecipients.name, email: s.messageRecipients.email, status: s.messageRecipients.status, error: s.messageRecipients.error })
      .from(s.messageRecipients)
      .where(eq(s.messageRecipients.messageId, id))
      .orderBy(asc(s.messageRecipients.name));
    return { ...m, sender: sender?.name ?? null, recipients };
  });
}
