import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { appUrl, sendEmail, templates, type LeadEmail } from "@/lib/email";
import { phoneDigits } from "@/lib/import";
import type { FieldErrors, Result } from "./accounts";

/*
 * Leads: people interested in joining. Staff add them (with a trial session if one's booked), Junbi emails
 * a welcome straight away and a reminder the day before the session, and the lead shows as converted
 * as soon as the family signs up with the club's link (or staff add them as a student).
 */

export const LEAD_STATUSES = ["new", "booked", "attended", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_SOURCES = ["Facebook", "Instagram", "Google", "Website", "Walk-in", "Phone call", "Friend or family", "Flyer", "Event", "Other"] as const;

const inScope = (actor: Actor, siteId: string | null) => actor.sites === "all" || !siteId || actor.sites.includes(siteId);

/** Sites and classes for the add-lead form. */
export async function leadOptions(actor: Actor) {
  assertCan(actor, "students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const sites = (await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name))).filter((x) => inScope(actor, x.id));
    const classes = (
      await tx
        .select({ id: s.classes.id, name: s.classes.name, siteId: s.classes.siteId, weekday: s.classes.weekday, startsAt: s.classes.startsAt })
        .from(s.classes)
        .where(eq(s.classes.archived, false))
        .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt))
    ).filter((c) => inScope(actor, c.siteId));
    return { sites, classes, sources: LEAD_SOURCES };
  });
}

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const leadSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter their first name.").max(80),
    lastName: z.string().trim().max(80).optional().transform((v) => v ?? ""),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .optional()
      .transform((v) => v || null)
      .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address."),
    phone: optText(40),
    studentName: optText(80),
    studentAge: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 2 && v <= 99), "Enter an age from 2 to 99."),
    siteId: optText(40),
    classId: optText(40),
    sessionDate: optText(10).refine((v) => !v || (isoDate.test(v) && !Number.isNaN(Date.parse(v))), "Enter a date."),
    sessionTime: optText(5).refine((v) => !v || /^\d{2}:\d{2}$/.test(v), "Enter a time."),
    source: optText(40),
    notes: optText(2000),
  })
  .superRefine((d, ctx) => {
    if (!d.email && !d.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email or a phone number so you can reach them." });
    if (d.sessionDate && !d.classId && !d.sessionTime) ctx.addIssue({ code: "custom", path: ["sessionTime"], message: "Pick a class or enter a time." });
    if ((d.classId || d.sessionTime) && !d.sessionDate) ctx.addIssue({ code: "custom", path: ["sessionDate"], message: "Enter the date of their trial." });
  });

export type LeadInput = z.input<typeof leadSchema>;

function errorsOf(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** Works out the session time from the class (or the time typed in), on the date given, in UK time. */
async function sessionFor(tx: Tx, d: z.output<typeof leadSchema>): Promise<{ classId: string | null; siteId: string | null; at: Date | null } | { error: FieldErrors }> {
  if (!d.sessionDate) return { classId: null, siteId: d.siteId, at: null };
  let time = d.sessionTime;
  let siteId = d.siteId;
  if (d.classId) {
    if (!z.string().uuid().safeParse(d.classId).success) return { error: { classId: "Choose a class." } };
    const [c] = await tx.select({ startsAt: s.classes.startsAt, siteId: s.classes.siteId, weekday: s.classes.weekday }).from(s.classes).where(eq(s.classes.id, d.classId));
    if (!c) return { error: { classId: "Choose a class." } };
    const dow = ((new Date(`${d.sessionDate}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (dow !== c.weekday) {
      const day = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][c.weekday - 1];
      return { error: { sessionDate: `That class is on a ${day}. Pick a ${day}.` } };
    }
    time = c.startsAt.slice(0, 5);
    siteId = c.siteId;
  }
  const [r] = (await tx.execute(sql`select ((${d.sessionDate}::date + ${time}::time) at time zone 'Europe/London') as at`)) as unknown as Array<{ at: Date | string }>;
  return { classId: d.classId, siteId, at: new Date(r.at) };
}

/** Everything the emails need about one lead. */
async function emailDetails(tx: Tx, clubId: string, leadId: string): Promise<(LeadEmail & { to: string | null; replyTo: string | null }) | null> {
  const [l] = await tx
    .select({ firstName: s.leads.firstName, email: s.leads.email, studentName: s.leads.studentName, sessionAt: s.leads.sessionAt, className: s.classes.name, siteName: s.sites.name, address: s.sites.address })
    .from(s.leads)
    .leftJoin(s.classes, eq(s.classes.id, s.leads.classId))
    .leftJoin(s.sites, eq(s.sites.id, s.leads.siteId))
    .where(eq(s.leads.id, leadId));
  if (!l) return null;
  const [club] = await tx.select({ name: s.clubs.name, token: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, clubId));
  const [owner] = (await tx.execute(sql`select u.email from club_staff cs join users u on u.id = cs.user_id where cs.role = 'owner' limit 1`)) as unknown as Array<{ email: string }>;
  return {
    to: l.email,
    replyTo: owner?.email ?? null,
    firstName: l.firstName,
    studentName: l.studentName,
    clubName: club.name,
    session: l.sessionAt ? { when: l.sessionAt, className: l.className, siteName: l.siteName, address: l.address } : null,
    signupUrl: `${await appUrl()}/join/${club.token}`,
  };
}

async function sendWelcome(clubId: string, leadId: string) {
  const d = await withClub({ clubId }, (tx) => emailDetails(tx, clubId, leadId));
  if (!d?.to) return false;
  const t = templates.leadWelcome(d);
  const r = await sendEmail({ to: d.to, ...t, template: "lead-welcome", clubId, fromName: d.clubName, replyTo: d.replyTo ?? undefined });
  if (r.status === "sent" || r.status === "logged") {
    await withClub({ clubId }, (tx) => tx.update(s.leads).set({ welcomeSentAt: new Date() }).where(eq(s.leads.id, leadId)));
    return true;
  }
  return false;
}

/** Adds a lead and emails them straight away. */
export async function addLead(actor: Actor, input: LeadInput): Promise<Result<{ id: string; emailed: boolean }>> {
  assertCan(actor, "students.edit");
  const p = leadSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: errorsOf(p.error) };
  const d = p.data;
  const made = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    if (d.siteId) {
      if (!z.string().uuid().safeParse(d.siteId).success) return { error: { siteId: "Choose a site." } };
      const [site] = await tx.select({ id: s.sites.id }).from(s.sites).where(eq(s.sites.id, d.siteId));
      if (!site || !inScope(actor, site.id)) return { error: { siteId: "Choose a site." } };
    }
    const session = await sessionFor(tx, d);
    if ("error" in session) return session;
    if (!inScope(actor, session.siteId)) return { error: { classId: "Choose a class at your site." } };
    const [row] = await tx
      .insert(s.leads)
      .values({
        clubId: actor.clubId,
        siteId: session.siteId,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        studentName: d.studentName,
        studentAge: d.studentAge,
        classId: session.classId,
        sessionAt: session.at,
        source: d.source,
        notes: d.notes,
        status: session.at ? "booked" : "new",
        createdByUserId: actor.userId,
      })
      .returning({ id: s.leads.id });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "lead", entityId: row.id });
    return { id: row.id };
  });
  if ("error" in made) return { ok: false, errors: made.error as FieldErrors };
  const emailed = d.email ? await sendWelcome(actor.clubId, made.id) : false;
  return { ok: true, value: { id: made.id, emailed } };
}

/** Books (or moves) a lead's trial session and emails them the details. */
export async function bookLeadSession(actor: Actor, leadId: string, input: Pick<LeadInput, "classId" | "sessionDate" | "sessionTime">): Promise<Result<{ emailed: boolean }>> {
  assertCan(actor, "students.edit");
  if (!z.string().uuid().safeParse(leadId).success) return { ok: false, errors: { form: "Lead not found." } };
  const base = { firstName: "x", email: "x@example.com" };
  const p = leadSchema.safeParse({ ...base, ...input });
  if (!p.success) return { ok: false, errors: errorsOf(p.error) };
  if (!p.data.sessionDate) return { ok: false, errors: { sessionDate: "Enter the date of their trial." } };
  const r = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [lead] = await tx.select({ id: s.leads.id, siteId: s.leads.siteId, email: s.leads.email, status: s.leads.status }).from(s.leads).where(eq(s.leads.id, leadId));
    if (!lead || !inScope(actor, lead.siteId)) return { error: { form: "Lead not found." } as FieldErrors };
    const session = await sessionFor(tx, { ...p.data, siteId: lead.siteId });
    if ("error" in session) return session;
    await tx
      .update(s.leads)
      .set({ classId: session.classId, siteId: session.siteId, sessionAt: session.at, reminderSentAt: null, status: lead.status === "new" || lead.status === "lost" ? "booked" : lead.status })
      .where(eq(s.leads.id, leadId));
    return { email: lead.email };
  });
  if ("error" in r) return { ok: false, errors: r.error };
  const emailed = r.email ? await sendWelcome(actor.clubId, leadId) : false;
  return { ok: true, value: { emailed } };
}

export async function setLeadStatus(actor: Actor, leadId: string, status: string) {
  assertCan(actor, "students.edit");
  const st = z.enum(["new", "booked", "attended", "lost"]).safeParse(status);
  if (!st.success || !z.string().uuid().safeParse(leadId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [lead] = await tx.select({ siteId: s.leads.siteId }).from(s.leads).where(eq(s.leads.id, leadId));
    if (!lead || !inScope(actor, lead.siteId)) return;
    await tx.update(s.leads).set({ status: st.data }).where(and(eq(s.leads.id, leadId), ne(s.leads.status, "converted")));
  });
}

export async function deleteLead(actor: Actor, leadId: string) {
  assertCan(actor, "students.edit");
  if (!z.string().uuid().safeParse(leadId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [lead] = await tx.select({ siteId: s.leads.siteId }).from(s.leads).where(eq(s.leads.id, leadId));
    if (!lead || !inScope(actor, lead.siteId)) return;
    await tx.delete(s.leads).where(eq(s.leads.id, leadId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "delete", entity: "lead", entityId: leadId });
  });
}

const leadColumns = {
  id: s.leads.id,
  firstName: s.leads.firstName,
  lastName: s.leads.lastName,
  email: s.leads.email,
  phone: s.leads.phone,
  studentName: s.leads.studentName,
  studentAge: s.leads.studentAge,
  siteId: s.leads.siteId,
  site: s.sites.name,
  className: s.classes.name,
  sessionAt: s.leads.sessionAt,
  source: s.leads.source,
  notes: s.leads.notes,
  status: s.leads.status,
  convertedStudentId: s.leads.convertedStudentId,
  convertedAt: s.leads.convertedAt,
  welcomeSentAt: s.leads.welcomeSentAt,
  reminderSentAt: s.leads.reminderSentAt,
  createdAt: s.leads.createdAt,
};

/** All leads the person can see, newest first, with counts for the summary. */
export async function listLeads(actor: Actor) {
  assertCan(actor, "students.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = (
      await tx
        .select(leadColumns)
        .from(s.leads)
        .leftJoin(s.sites, eq(s.sites.id, s.leads.siteId))
        .leftJoin(s.classes, eq(s.classes.id, s.leads.classId))
        .orderBy(desc(s.leads.createdAt))
        .limit(500)
    ).filter((l) => inScope(actor, l.siteId));
    const count = (st: string) => rows.filter((r) => r.status === st).length;
    const since = Date.now() - 90 * 86_400_000;
    const recent = rows.filter((r) => r.createdAt.getTime() > since);
    const convertedRecent = recent.filter((r) => r.status === "converted").length;
    return {
      leads: rows,
      counts: { new: count("new"), booked: count("booked"), attended: count("attended"), converted: count("converted"), lost: count("lost") },
      conversion: recent.length ? Math.round((convertedRecent / recent.length) * 100) : null,
    };
  });
}

export async function getLead(actor: Actor, leadId: string) {
  assertCan(actor, "students.view");
  if (!z.string().uuid().safeParse(leadId).success) return null;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [l] = await tx
      .select({ ...leadColumns, classId: s.leads.classId, student: sql<string | null>`(select first_name || ' ' || last_name from students where id = ${s.leads.convertedStudentId})` })
      .from(s.leads)
      .leftJoin(s.sites, eq(s.sites.id, s.leads.siteId))
      .leftJoin(s.classes, eq(s.classes.id, s.leads.classId))
      .where(eq(s.leads.id, leadId));
    return l && inScope(actor, l.siteId) ? l : null;
  });
}

/** Trial sessions coming up today and tomorrow, for the Today page. */
export async function upcomingTrials(actor: Actor) {
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select(leadColumns)
      .from(s.leads)
      .leftJoin(s.sites, eq(s.sites.id, s.leads.siteId))
      .leftJoin(s.classes, eq(s.classes.id, s.leads.classId))
      .where(and(inArray(s.leads.status, ["new", "booked"]), sql`${s.leads.sessionAt} > now() - interval '2 hours'`, sql`${s.leads.sessionAt} < date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London' + interval '2 days'`))
      .orderBy(asc(s.leads.sessionAt));
    return rows.filter((l) => inScope(actor, l.siteId));
  });
}

/**
 * Marks matching leads as converted when a family signs up or staff add a student.
 * Matches on email, or on phone number when there's no email match. Runs inside the caller's club transaction.
 */
export async function convertLeads(tx: Tx, clubId: string, m: { email?: string | null; phone?: string | null; studentId: string }) {
  const email = m.email?.trim().toLowerCase() || null;
  const phone = m.phone ? phoneDigits(m.phone) : "";
  const conds = [
    ...(email ? [sql`lower(${s.leads.email}) = ${email}`] : []),
    ...(phone.length >= 7 ? [sql`right(regexp_replace(regexp_replace(coalesce(${s.leads.phone}, ''), '\\D', '', 'g'), '^44', '0'), 10) = right(${phone}, 10)`] : []),
  ];
  if (!conds.length) return 0;
  const done = await tx
    .update(s.leads)
    .set({ status: "converted", convertedStudentId: m.studentId, convertedAt: new Date() })
    .where(and(eq(s.leads.clubId, clubId), ne(s.leads.status, "converted"), or(...conds)))
    .returning({ id: s.leads.id });
  return done.length;
}

/** Hourly: reminds leads whose trial session is in the next 24 hours. Each reminder only goes once. */
export async function sendLeadReminders() {
  const due = (await db().execute(sql`select * from lead_reminders_due()`)) as unknown as Array<{ lead_id: string; club_id: string }>;
  let sent = 0;
  for (const r of due) {
    const d = await withClub({ clubId: r.club_id }, (tx) => emailDetails(tx, r.club_id, r.lead_id));
    if (!d?.to || !d.session) continue;
    const t = templates.leadReminder(d);
    const res = await sendEmail({
      to: d.to,
      ...t,
      template: "lead-reminder",
      clubId: r.club_id,
      fromName: d.clubName,
      replyTo: d.replyTo ?? undefined,
      dedupeKey: `lead-reminder:${r.lead_id}:${d.session.when.toISOString()}`,
    });
    if (res.status === "sent" || res.status === "logged" || res.status === "skipped") {
      await withClub({ clubId: r.club_id }, (tx) => tx.update(s.leads).set({ reminderSentAt: new Date() }).where(and(eq(s.leads.id, r.lead_id), isNull(s.leads.reminderSentAt))));
      if (res.status !== "skipped") sent++;
    }
  }
  return { due: due.length, sent };
}
