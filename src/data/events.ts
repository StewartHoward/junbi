import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, can, canAtSite, ForbiddenError, type Actor } from "@/auth/permissions";
import { signLink, verifyLink, decrypt } from "@/lib/payments/crypto";
import { appUrl, sendEmail, templates } from "@/lib/email";
import { disciplineName } from "@/lib/disciplines";
import { isRealDate } from "@/lib/dates";
import type { FieldErrors, Result } from "./accounts";
import { CLUB_TZ, todayISO } from "./classes";
import type { ConnectedAccount, ProviderId } from "@/lib/payments/types";

/*
 * Gradings and events. Staff set one up, invite families (for a grading, the students ready for their
 * next belt are picked out for them), families book from the emailed link and pay by card on the club's
 * own Stripe, then for gradings the results become belts.
 *
 * Booking statuses: invited, pending (on the card page now), booked (confirmed, nothing to pay online),
 * paid, declined, cancelled. A place is taken by pending, booked and paid.
 */

const TAKES_PLACE = ["pending", "booked", "paid"] as const;
const GOING = ["booked", "paid"] as const;

/** Instructors run gradings, so they can see events and record results. Setting them up is for owners and admins. */
export const canSeeEvents = (actor: Actor) => can(actor, "grading.record") || can(actor, "classes.manage");

const fmtWhen = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: CLUB_TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).replace(" at ", ", ");
const money = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

/* ---------- Setting up ---------- */

const eventSchema = z
  .object({
    kind: z.enum(["grading", "event"]),
    title: z.string().trim().min(1, "Give it a name.").max(120),
    discipline: z.string().trim().max(40).optional(),
    siteId: z.string().optional(),
    date: z.string().refine((v) => isRealDate(v), "Choose a date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
    location: z.string().trim().max(200).optional(),
    fee: z.string().trim().max(12).optional(),
    capacity: z.string().trim().max(6).optional(),
    examiner: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "grading" && !d.discipline) ctx.addIssue({ code: "custom", path: ["discipline"], message: "Choose the art being graded." });
    if (d.fee && !/^£?\d{1,4}(\.\d{1,2})?$/.test(d.fee)) ctx.addIssue({ code: "custom", path: ["fee"], message: "Enter an amount like 25 or 25.50, or leave it empty if it's free." });
    if (d.capacity && !/^\d{1,4}$/.test(d.capacity)) ctx.addIssue({ code: "custom", path: ["capacity"], message: "Enter a number, or leave it empty for no limit." });
  });
export type EventInput = z.input<typeof eventSchema>;

function issues(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createEvent(actor: Actor, input: EventInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "classes.manage");
  const p = eventSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: issues(p.error) };
  const d = p.data;
  if (d.date < todayISO()) return { ok: false, errors: { date: "The date can't be in the past." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    let siteId: string | null = null;
    if (d.siteId) {
      const [site] = await tx.select({ id: s.sites.id }).from(s.sites).where(eq(s.sites.id, d.siteId));
      if (!site || !canAtSite(actor, "classes.manage", site.id)) return { ok: false as const, errors: { siteId: "Choose a site." } };
      siteId = site.id;
    } else if (actor.sites !== "all") {
      return { ok: false as const, errors: { siteId: "Choose a site." } };
    }
    if (d.kind === "grading") {
      const [art] = await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(and(eq(s.clubDisciplines.discipline, d.discipline!), eq(s.clubDisciplines.active, true)));
      if (!art) return { ok: false as const, errors: { discipline: "Choose the art being graded." } };
    }
    const [ev] = await tx
      .insert(s.events)
      .values({
        clubId: actor.clubId,
        kind: d.kind,
        title: d.title,
        discipline: d.kind === "grading" ? d.discipline! : d.discipline || null,
        siteId,
        startsAt: sql`((${d.date}::date + ${d.time}::time) at time zone ${CLUB_TZ})`,
        location: d.location || null,
        feePence: d.fee ? Math.round(Number(d.fee.replace("£", "")) * 100) : 0,
        capacity: d.capacity ? Number(d.capacity) || null : null,
        examiner: d.examiner || null,
        notes: d.notes || null,
      })
      .returning({ id: s.events.id });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "event", entityId: ev.id, after: { kind: d.kind, title: d.title } });
    return { ok: true as const, value: { id: ev.id } };
  });
}

export async function cancelEvent(actor: Actor, eventId: string) {
  assertCan(actor, "classes.manage");
  if (!z.string().uuid().safeParse(eventId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [ev] = await tx.select({ siteId: s.events.siteId }).from(s.events).where(eq(s.events.id, eventId));
    if (!ev) return;
    if (ev.siteId ? !canAtSite(actor, "classes.manage", ev.siteId) : actor.sites !== "all") throw new ForbiddenError("classes.manage");
    await tx.update(s.events).set({ cancelled: true }).where(eq(s.events.id, eventId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "event", entityId: eventId, after: { cancelled: true } });
  });
}

/* ---------- Lists and the event page ---------- */

const siteOk = (actor: Actor, siteId: string | null) => actor.sites === "all" || (siteId !== null && actor.sites.includes(siteId));

export async function listEvents(actor: Actor) {
  if (!canSeeEvents(actor)) throw new ForbiddenError("grading.record");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({
        id: s.events.id,
        kind: s.events.kind,
        title: s.events.title,
        discipline: s.events.discipline,
        siteId: s.events.siteId,
        site: s.sites.name,
        startsAt: s.events.startsAt,
        feePence: s.events.feePence,
        capacity: s.events.capacity,
        cancelled: s.events.cancelled,
        going: sql<number>`(select count(*)::int from event_bookings b where b.event_id = ${s.events.id} and b.status in ('booked', 'paid'))`,
        invited: sql<number>`(select count(*)::int from event_bookings b where b.event_id = ${s.events.id} and b.status = 'invited')`,
      })
      .from(s.events)
      .leftJoin(s.sites, eq(s.sites.id, s.events.siteId))
      .orderBy(desc(s.events.startsAt));
    const now = Date.now();
    const shown = rows.filter((r) => siteOk(actor, r.siteId)).map((r) => ({ ...r, when: fmtWhen(r.startsAt), art: r.discipline ? disciplineName(r.discipline) : null }));
    return {
      upcoming: shown.filter((r) => r.startsAt.getTime() >= now - 6 * 3600_000).reverse(),
      past: shown.filter((r) => r.startsAt.getTime() < now - 6 * 3600_000).slice(0, 30),
    };
  });
}

type Belt = { id: string; name: string; beltColour: string; sortOrder: number; classesRequired: number };

/**
 * For a grading: each student's current belt in the art, the next one, classes since they last graded,
 * and whether they're ready. Beginners with no belt are going for the first grade.
 */
async function gradingCandidates(tx: Tx, discipline: string, siteId: string | null) {
  const ladder: Belt[] = await tx
    .select({ id: s.grades.id, name: s.grades.name, beltColour: s.grades.beltColour, sortOrder: s.grades.sortOrder, classesRequired: s.grades.classesRequired })
    .from(s.grades)
    .where(eq(s.grades.discipline, discipline))
    .orderBy(asc(s.grades.sortOrder));
  const people = await tx
    .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, siteId: s.students.siteId, joinedOn: s.students.joinedOn, householdId: s.students.householdId })
    .from(s.students)
    .where(and(inArray(s.students.status, ["active", "trial"]), siteId ? eq(s.students.siteId, siteId) : undefined))
    .orderBy(asc(s.students.firstName), asc(s.students.lastName));
  if (!people.length || !ladder.length) return { ladder, people: [] };
  const ids = people.map((p) => p.id);
  const results = await tx
    .select({ studentId: s.gradingResults.studentId, gradeId: s.gradingResults.gradeId, gradedOn: s.gradingResults.gradedOn, sortOrder: s.grades.sortOrder })
    .from(s.gradingResults)
    .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
    .where(and(inArray(s.gradingResults.studentId, ids), eq(s.grades.discipline, discipline), ne(s.gradingResults.outcome, "fail")))
    .orderBy(asc(s.gradingResults.gradedOn), asc(s.grades.sortOrder));
  const current = new Map<string, { gradeId: string; gradedOn: string }>();
  for (const r of results) current.set(r.studentId, { gradeId: r.gradeId, gradedOn: r.gradedOn });
  const visits = await tx
    .select({ studentId: s.attendance.studentId, at: s.sessions.startsAt })
    .from(s.attendance)
    .innerJoin(s.sessions, eq(s.sessions.id, s.attendance.sessionId))
    .innerJoin(s.classes, eq(s.classes.id, s.sessions.classId))
    .where(and(inArray(s.attendance.studentId, ids), eq(s.classes.discipline, discipline), gt(s.sessions.startsAt, new Date(Date.now() - 3 * 365 * 86_400_000))));
  const artCount = (await tx.select({ n: sql<number>`count(*)::int` }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)))[0]?.n ?? 1;
  const attended = new Set(visits.map((v) => v.studentId));

  return {
    ladder,
    people: people
      // In a club with several arts, only people who train in this one.
      .filter((p) => artCount <= 1 || current.has(p.id) || attended.has(p.id))
      .map((p) => {
        const cur = current.get(p.id);
        const held = cur ? ladder.find((g) => g.id === cur.gradeId) ?? null : null;
        const next = held ? ladder.find((g) => g.sortOrder > held.sortOrder) ?? null : ladder[0];
        const since = cur ? new Date(`${cur.gradedOn}T23:59:59Z`).getTime() : 0;
        const classesSince = visits.filter((v) => v.studentId === p.id && v.at.getTime() > since).length;
        const needed = (held ?? ladder[0]).classesRequired;
        return { ...p, held, next, classesSince, needed, ready: Boolean(next && needed > 0 && classesSince >= needed) };
      }),
  };
}

export async function getEvent(actor: Actor, eventId: string) {
  if (!canSeeEvents(actor)) throw new ForbiddenError("grading.record");
  if (!z.string().uuid().safeParse(eventId).success) return null;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [ev] = await tx.select({ event: s.events, site: s.sites.name }).from(s.events).leftJoin(s.sites, eq(s.sites.id, s.events.siteId)).where(eq(s.events.id, eventId));
    if (!ev || !siteOk(actor, ev.event.siteId)) return null;
    const e = ev.event;
    const bookings = await tx
      .select({
        id: s.eventBookings.id,
        studentId: s.eventBookings.studentId,
        firstName: s.students.firstName,
        lastName: s.students.lastName,
        status: s.eventBookings.status,
        amountPence: s.eventBookings.amountPence,
        outcome: s.eventBookings.outcome,
        grade: s.grades.name,
        beltColour: s.grades.beltColour,
      })
      .from(s.eventBookings)
      .innerJoin(s.students, eq(s.students.id, s.eventBookings.studentId))
      .leftJoin(s.grades, eq(s.grades.id, s.eventBookings.gradeId))
      .where(eq(s.eventBookings.eventId, e.id))
      .orderBy(asc(s.students.firstName), asc(s.students.lastName));

    const booked = new Set(bookings.filter((b) => b.status !== "cancelled" && b.status !== "declined").map((b) => b.studentId));
    let candidates: Array<{ id: string; name: string; detail: string; ready: boolean }> = [];
    if (can(actor, "classes.manage") && !e.cancelled) {
      if (e.kind === "grading" && e.discipline) {
        const g = await gradingCandidates(tx, e.discipline, e.siteId);
        candidates = g.people
          .filter((p) => !booked.has(p.id) && p.next && siteOk(actor, p.siteId))
          .map((p) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            detail: `${p.held ? p.held.name : "No belt yet"} → ${p.next!.name} · ${p.classesSince} ${p.classesSince === 1 ? "class" : "classes"}${p.needed ? ` of ${p.needed}` : ""}`,
            ready: p.ready,
          }))
          .sort((a, b) => Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name));
      } else {
        const people = await tx
          .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, siteId: s.students.siteId })
          .from(s.students)
          .where(and(inArray(s.students.status, ["active", "trial"]), e.siteId ? eq(s.students.siteId, e.siteId) : undefined))
          .orderBy(asc(s.students.firstName), asc(s.students.lastName));
        candidates = people.filter((p) => !booked.has(p.id) && siteOk(actor, p.siteId)).map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, detail: "", ready: false }));
      }
    }
    const seeMoney = can(actor, "payments.view");
    const going = bookings.filter((b) => (GOING as readonly string[]).includes(b.status)).length;
    return {
      id: e.id,
      kind: e.kind as "grading" | "event",
      title: e.title,
      art: e.discipline ? disciplineName(e.discipline) : null,
      site: ev.site,
      when: fmtWhen(e.startsAt),
      date: new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_TZ }).format(e.startsAt),
      past: e.startsAt.getTime() < Date.now() - 3600_000,
      location: e.location,
      fee: e.feePence ? money(e.feePence) : null,
      capacity: e.capacity,
      examiner: e.examiner,
      notes: e.notes,
      cancelled: e.cancelled,
      going,
      collectedPence: seeMoney ? bookings.filter((b) => b.status === "paid").reduce((n, b) => n + b.amountPence, 0) : null,
      bookings: bookings.map((b) => ({
        id: b.id,
        studentId: b.studentId,
        name: `${b.firstName} ${b.lastName}`,
        // Instructors see whether someone is coming, not whether they've paid.
        status: seeMoney ? b.status : b.status === "paid" ? "booked" : b.status,
        grade: b.grade,
        beltColour: b.beltColour,
        outcome: b.outcome,
      })),
      candidates,
      canManage: can(actor, "classes.manage"),
      canRecord: can(actor, "grading.record"),
    };
  });
}

/* ---------- Inviting and booking ---------- */

type BookClaims = { c: string; e: string; h: string };

async function nextGradeFor(tx: Tx, discipline: string, studentIds: string[]) {
  const ladder = await tx.select({ id: s.grades.id, sortOrder: s.grades.sortOrder }).from(s.grades).where(eq(s.grades.discipline, discipline)).orderBy(asc(s.grades.sortOrder));
  const held = studentIds.length
    ? await tx
        .select({ studentId: s.gradingResults.studentId, sortOrder: s.grades.sortOrder })
        .from(s.gradingResults)
        .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
        .where(and(inArray(s.gradingResults.studentId, studentIds), eq(s.grades.discipline, discipline), ne(s.gradingResults.outcome, "fail")))
        .orderBy(asc(s.gradingResults.gradedOn), asc(s.grades.sortOrder))
    : [];
  const top = new Map<string, number>();
  for (const h of held) top.set(h.studentId, h.sortOrder);
  return new Map(studentIds.map((id) => [id, top.has(id) ? ladder.find((g) => g.sortOrder > top.get(id)!)?.id ?? null : ladder[0]?.id ?? null]));
}

/**
 * Invites the chosen students and emails each family one link to book (and pay for) everyone invited.
 * Inviting someone again re-sends the email.
 */
export async function inviteToEvent(actor: Actor, eventId: string, studentIds: string[]): Promise<Result<{ families: number; noEmail: string[] }>> {
  assertCan(actor, "classes.manage");
  const ids = [...new Set(studentIds)].filter((x) => z.string().uuid().safeParse(x).success).slice(0, 500);
  if (!z.string().uuid().safeParse(eventId).success) return { ok: false, errors: { form: "Event not found." } };
  if (!ids.length) return { ok: false, errors: { form: "Tick at least one student to invite." } };
  const prepared = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, eventId));
    if (!e || !siteOk(actor, e.siteId)) return { error: "Event not found." };
    if (e.cancelled) return { error: "This has been cancelled." };
    if (e.startsAt.getTime() < Date.now()) return { error: "This has already happened." };
    const people = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, householdId: s.students.householdId, siteId: s.students.siteId })
      .from(s.students)
      .where(and(inArray(s.students.id, ids), ne(s.students.status, "cancelled")));
    const mine = people.filter((p) => siteOk(actor, p.siteId));
    if (!mine.length) return { error: "Tick at least one student to invite." };
    const next = e.kind === "grading" && e.discipline ? await nextGradeFor(tx, e.discipline, mine.map((p) => p.id)) : new Map<string, string | null>();
    for (const p of mine) {
      await tx
        .insert(s.eventBookings)
        .values({ clubId: actor.clubId, eventId: e.id, studentId: p.id, gradeId: next.get(p.id) ?? null, status: "invited", amountPence: e.feePence })
        .onConflictDoUpdate({
          target: [s.eventBookings.eventId, s.eventBookings.studentId],
          // Someone who said no (or was taken off) can be asked again. Anyone already booked stays booked.
          set: { status: sql`case when ${s.eventBookings.status} in ('declined', 'cancelled') then 'invited' else ${s.eventBookings.status} end` },
        });
    }
    const households = [...new Set(mine.map((p) => p.householdId))];
    const payers = await tx
      .select({ householdId: s.guardians.householdId, firstName: s.guardians.firstName, lastName: s.guardians.lastName, email: s.guardians.email, isPayer: s.guardians.isPayer, createdAt: s.guardians.createdAt })
      .from(s.guardians)
      .where(and(inArray(s.guardians.householdId, households), sql`${s.guardians.email} is not null`))
      .orderBy(desc(s.guardians.isPayer), asc(s.guardians.createdAt));
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "event_invite", entityId: e.id, after: { students: mine.length } });
    return {
      event: e,
      clubName: club.name,
      families: households.map((h) => ({ householdId: h, names: mine.filter((p) => p.householdId === h).map((p) => p.firstName), payer: payers.find((g) => g.householdId === h) ?? null })),
    };
  });
  if ("error" in prepared) return { ok: false, errors: { form: prepared.error! } };
  const base = await appUrl();
  const ttl = Math.max(3600, Math.floor((prepared.event.startsAt.getTime() - Date.now()) / 1000) + 86_400);
  const noEmail: string[] = [];
  let sent = 0;
  for (const f of prepared.families) {
    if (!f.payer?.email) {
      noEmail.push(...f.names);
      continue;
    }
    const token = signLink<BookClaims>("book", { c: actor.clubId, e: prepared.event.id, h: f.householdId }, ttl);
    const t = templates.eventInvite(`${f.payer.firstName} ${f.payer.lastName}`, prepared.clubName, prepared.event.kind === "grading", prepared.event.title, fmtWhen(prepared.event.startsAt), f.names, prepared.event.feePence ? money(prepared.event.feePence) : null, `${base}/book/${token}`);
    await sendEmail({ to: f.payer.email, ...t, template: "event-invite", clubId: actor.clubId });
    sent++;
  }
  return { ok: true, value: { families: sent, noEmail } };
}

/** Staff add someone themselves, e.g. they paid at the desk. */
export async function addBooking(actor: Actor, eventId: string, studentId: string, paid: boolean): Promise<Result> {
  assertCan(actor, "classes.manage");
  if (!z.string().uuid().safeParse(eventId).success || !z.string().uuid().safeParse(studentId).success) return { ok: false, errors: { form: "Choose a student." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, eventId));
    if (!e || !siteOk(actor, e.siteId) || e.cancelled) return { ok: false as const, errors: { form: "Event not found." } };
    const [st] = await tx.select({ id: s.students.id, siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st || !siteOk(actor, st.siteId)) return { ok: false as const, errors: { form: "Choose a student." } };
    const next = e.kind === "grading" && e.discipline ? (await nextGradeFor(tx, e.discipline, [st.id])).get(st.id) ?? null : null;
    const status = paid && e.feePence ? "paid" : "booked";
    await tx
      .insert(s.eventBookings)
      .values({ clubId: actor.clubId, eventId: e.id, studentId: st.id, gradeId: next, status, amountPence: e.feePence, paidAt: status === "paid" ? new Date() : null })
      .onConflictDoUpdate({ target: [s.eventBookings.eventId, s.eventBookings.studentId], set: { status, paidAt: status === "paid" ? new Date() : null } });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "event_booking", entityId: st.id, after: { eventId: e.id, status } });
    return { ok: true as const, value: undefined };
  });
}

export async function setBookingStatus(actor: Actor, bookingId: string, status: "cancelled" | "paid" | "booked") {
  assertCan(actor, "classes.manage");
  if (!z.string().uuid().safeParse(bookingId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [b] = await tx.select({ id: s.eventBookings.id, siteId: s.events.siteId, eventId: s.events.id }).from(s.eventBookings).innerJoin(s.events, eq(s.events.id, s.eventBookings.eventId)).where(eq(s.eventBookings.id, bookingId));
    if (!b || !siteOk(actor, b.siteId)) return;
    await tx.update(s.eventBookings).set({ status, ...(status === "paid" ? { paidAt: new Date() } : {}) }).where(eq(s.eventBookings.id, bookingId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "event_booking", entityId: bookingId, after: { status } });
  });
}

/* ---------- Results ---------- */

const OUTCOMES = ["pass", "merit", "distinction", "fail"] as const;

/** Saves grading results. Passes become belts (and show on the student's profile); changing a result updates it. */
export async function recordResults(actor: Actor, eventId: string, results: Record<string, string>): Promise<Result<{ saved: number }>> {
  assertCan(actor, "grading.record");
  if (!z.string().uuid().safeParse(eventId).success) return { ok: false, errors: { form: "Event not found." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, eventId));
    if (!e || e.kind !== "grading" || !siteOk(actor, e.siteId)) return { ok: false as const, errors: { form: "Grading not found." } };
    const gradedOn = new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_TZ }).format(e.startsAt);
    if (gradedOn > todayISO()) return { ok: false as const, errors: { form: "Results can be added on the day of the grading." } };
    const rows = await tx
      .select({ id: s.eventBookings.id, studentId: s.eventBookings.studentId, gradeId: s.eventBookings.gradeId, outcome: s.eventBookings.outcome, resultId: s.eventBookings.gradingResultId, siteId: s.students.siteId })
      .from(s.eventBookings)
      .innerJoin(s.students, eq(s.students.id, s.eventBookings.studentId))
      .where(and(eq(s.eventBookings.eventId, e.id), inArray(s.eventBookings.status, [...GOING])));
    let saved = 0;
    for (const r of rows) {
      const raw = results[r.id];
      if (raw === undefined) continue;
      const outcome = (OUTCOMES as readonly string[]).includes(raw) ? (raw as (typeof OUTCOMES)[number]) : null;
      if (outcome === r.outcome || !r.gradeId || !canAtSite(actor, "grading.record", r.siteId)) continue;
      let resultId = r.resultId;
      if (outcome && resultId) {
        await tx.update(s.gradingResults).set({ outcome, examiner: e.examiner }).where(eq(s.gradingResults.id, resultId));
      } else if (outcome) {
        const [g] = await tx.insert(s.gradingResults).values({ clubId: actor.clubId, studentId: r.studentId, gradeId: r.gradeId, gradedOn, outcome, examiner: e.examiner }).returning({ id: s.gradingResults.id });
        resultId = g.id;
      } else if (resultId) {
        await tx.delete(s.gradingResults).where(eq(s.gradingResults.id, resultId));
        resultId = null;
      }
      await tx.update(s.eventBookings).set({ outcome, gradingResultId: resultId }).where(eq(s.eventBookings.id, r.id));
      saved++;
    }
    if (saved) await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "grading_results", entityId: e.id, after: { saved } });
    return { ok: true as const, value: { saved } };
  });
}

/* ---------- The family's booking page ---------- */

/** Places held by families who went to the card page but didn't pay go back after an hour (Stripe's page has expired by then). */
async function releaseStale(tx: Tx, eventId: string) {
  await tx
    .update(s.eventBookings)
    .set({ status: "invited", pendingSince: null })
    .where(and(eq(s.eventBookings.eventId, eventId), eq(s.eventBookings.status, "pending"), sql`${s.eventBookings.pendingSince} < now() - interval '65 minutes'`));
}

async function accountFor(tx: Tx): Promise<ConnectedAccount | null> {
  const [a] = await tx.select().from(s.clubPaymentAccounts);
  if (!a) return null;
  return { provider: a.provider as ProviderId, accountId: a.accountId, accessToken: a.accessTokenEnc ? decrypt(a.accessTokenEnc) : undefined };
}
/** Card payments go through the club's own Stripe. GoCardless clubs (and clubs with no payments) take payment at the club. */
async function cardAccount(tx: Tx) {
  const a = await accountFor(tx);
  if (!a || a.provider !== "stripe") return null;
  if (process.env.PAYMENTS_FAKE === "1") return a;
  const { ownStripe } = await import("@/lib/payments/stripe");
  return ownStripe(a) || process.env.STRIPE_SECRET_KEY ? a : null;
}

export type BookingPage = {
  clubName: string;
  kind: "grading" | "event";
  title: string;
  when: string;
  location: string | null;
  notes: string | null;
  feePence: number;
  card: boolean;
  full: boolean;
  people: Array<{ bookingId: string; name: string; grade: string | null; status: string }>;
};

export async function bookingPage(token: unknown): Promise<BookingPage | null> {
  const c = verifyLink<BookClaims>("book", token);
  if (!c) return null;
  return withClub({ clubId: c.c }, async (tx) => {
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, c.e));
    if (!e || e.cancelled) return null;
    await releaseStale(tx, e.id);
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, c.c));
    const people = await tx
      .select({ bookingId: s.eventBookings.id, firstName: s.students.firstName, lastName: s.students.lastName, grade: s.grades.name, status: s.eventBookings.status })
      .from(s.eventBookings)
      .innerJoin(s.students, eq(s.students.id, s.eventBookings.studentId))
      .leftJoin(s.grades, eq(s.grades.id, s.eventBookings.gradeId))
      .where(and(eq(s.eventBookings.eventId, e.id), eq(s.students.householdId, c.h), ne(s.eventBookings.status, "cancelled")))
      .orderBy(asc(s.students.firstName));
    if (!people.length) return null;
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.eventBookings).where(and(eq(s.eventBookings.eventId, e.id), inArray(s.eventBookings.status, [...TAKES_PLACE])));
    return {
      clubName: club.name,
      kind: e.kind as "grading" | "event",
      title: e.title,
      when: fmtWhen(e.startsAt),
      location: e.location,
      notes: e.notes,
      feePence: e.feePence,
      card: e.feePence > 0 && Boolean(await cardAccount(tx)),
      full: e.capacity !== null && n >= e.capacity,
      people: people.map((p) => ({ bookingId: p.bookingId, name: `${p.firstName} ${p.lastName}`, grade: p.grade, status: p.status })),
    };
  });
}

/**
 * The family books the people they ticked. Free, or no card payments: confirmed straight away (paid at the club).
 * Otherwise: a Stripe card page on the club's own account; the booking is confirmed when the payment goes through.
 */
export async function submitBooking(token: unknown, chosen: string[], declined: string[]): Promise<Result<{ url: string | null; confirmed: number }>> {
  const c = verifyLink<BookClaims>("book", token);
  if (!c) return { ok: false, errors: { form: "This link has run out. Ask the club for a new one." } };
  const prepared = await withClub({ clubId: c.c }, async (tx) => {
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, c.e));
    if (!e || e.cancelled) return { error: "This has been cancelled. The club will be in touch." };
    if (e.startsAt.getTime() < Date.now()) return { error: "Booking has closed." };
    await releaseStale(tx, e.id);
    const mine = await tx
      .select({ id: s.eventBookings.id, status: s.eventBookings.status, firstName: s.students.firstName, grade: s.grades.name, gradeId: s.eventBookings.gradeId })
      .from(s.eventBookings)
      .innerJoin(s.students, eq(s.students.id, s.eventBookings.studentId))
      .leftJoin(s.grades, eq(s.grades.id, s.eventBookings.gradeId))
      .where(and(eq(s.eventBookings.eventId, e.id), eq(s.students.householdId, c.h)));
    const open = mine.filter((b) => b.status === "invited" || b.status === "pending" || b.status === "declined");
    const pick = open.filter((b) => chosen.includes(b.id));
    const no = open.filter((b) => declined.includes(b.id) && !chosen.includes(b.id));
    if (no.length) await tx.update(s.eventBookings).set({ status: "declined" }).where(inArray(s.eventBookings.id, no.map((b) => b.id)));
    if (!pick.length) return no.length ? { done: true as const } : { error: "Tick who's coming." };
    if (e.capacity !== null) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.eventBookings)
        .where(and(eq(s.eventBookings.eventId, e.id), inArray(s.eventBookings.status, [...TAKES_PLACE]), notInArray(s.eventBookings.id, pick.map((b) => b.id))));
      if (n + pick.length > e.capacity) return { error: e.capacity - n > 0 ? `There ${e.capacity - n === 1 ? "is 1 place" : `are ${e.capacity - n} places`} left.` : "Sorry, it's full." };
    }
    const account = e.feePence > 0 ? await cardAccount(tx) : null;
    if (!account) {
      await tx.update(s.eventBookings).set({ status: "booked", amountPence: e.feePence }).where(inArray(s.eventBookings.id, pick.map((b) => b.id)));
      return { confirmed: pick.length };
    }
    const [payer] = await tx
      .select({ email: s.guardians.email })
      .from(s.guardians)
      .where(and(eq(s.guardians.householdId, c.h), sql`${s.guardians.email} is not null`))
      .orderBy(desc(s.guardians.isPayer), asc(s.guardians.createdAt))
      .limit(1);
    await tx.update(s.eventBookings).set({ status: "pending", pendingSince: new Date(), amountPence: e.feePence }).where(inArray(s.eventBookings.id, pick.map((b) => b.id)));
    return { pay: { account, event: e, items: pick, email: payer?.email ?? null } };
  });
  if ("error" in prepared) return { ok: false, errors: { form: prepared.error! } };
  if ("done" in prepared) return { ok: true, value: { url: null, confirmed: 0 } };
  if (!("pay" in prepared) || !prepared.pay) return { ok: true, value: { url: null, confirmed: "confirmed" in prepared ? prepared.confirmed ?? 0 : 0 } };

  const { account, event, items, email } = prepared.pay;
  const base = await appUrl();
  const ids = items.map((b) => b.id);
  try {
    let session: { id: string; url: string };
    if (process.env.PAYMENTS_FAKE === "1") {
      session = { id: `cs_fake_${ids[0]}`, url: `${base}/book/${token}/done?session=cs_fake_${ids[0]}&fake=1` };
    } else {
      const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
      const auth = stripeAuth(account);
      session = await stripeApi<{ id: string; url: string }>(
        "POST",
        "/checkout/sessions",
        {
          mode: "payment",
          ...(email ? { customer_email: email } : {}),
          line_items: items.map((b) => ({
            quantity: 1,
            price_data: { currency: "gbp", unit_amount: event.feePence, product_data: { name: `${event.title}: ${b.firstName}${b.grade ? ` (${b.grade})` : ""}` } },
          })),
          success_url: `${base}/book/${token}/done?session={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/book/${token}`,
          metadata: { junbi_event_id: event.id, junbi_bookings: ids.join(",") },
          payment_intent_data: { metadata: { junbi_event_id: event.id }, description: event.title },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        auth.account,
        undefined,
        auth.key,
      );
    }
    await withClub({ clubId: c.c }, (tx) => tx.update(s.eventBookings).set({ checkoutRef: session.id }).where(inArray(s.eventBookings.id, ids)));
    return { ok: true, value: { url: session.url, confirmed: 0 } };
  } catch (err) {
    console.error("Starting event card payment failed", err);
    await withClub({ clubId: c.c }, (tx) => tx.update(s.eventBookings).set({ status: "invited" }).where(and(inArray(s.eventBookings.id, ids), eq(s.eventBookings.status, "pending"))));
    return { ok: false, errors: { form: "We couldn't open the card payment page. Please try again in a minute." } };
  }
}

/**
 * Marks the bookings on a Stripe card payment as paid, once Stripe says it's paid. Called from the webhook and
 * from the page families come back to (whichever is first). Safe to call twice.
 */
export async function confirmCardPayment(clubId: string, sessionId: string): Promise<number> {
  if (!/^cs_[A-Za-z0-9_-]{1,200}$/.test(sessionId)) return 0;
  const account = await withClub({ clubId }, accountFor);
  if (!account) return 0;
  let paid = process.env.PAYMENTS_FAKE === "1" && sessionId.startsWith("cs_fake_");
  if (!paid) {
    const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
    const auth = stripeAuth(account);
    const session = await stripeApi<{ payment_status: string; metadata?: Record<string, string> }>("GET", `/checkout/sessions/${sessionId}`, null, auth.account, undefined, auth.key).catch(() => null);
    paid = session?.payment_status === "paid";
  }
  if (!paid) return 0;
  return withClub({ clubId }, async (tx) => {
    const done = await tx
      .update(s.eventBookings)
      .set({ status: "paid", paidAt: new Date(), pendingSince: null })
      // Paid even if the place had been released: they've paid, so they're coming.
      .where(and(eq(s.eventBookings.checkoutRef, sessionId), inArray(s.eventBookings.status, ["pending", "invited", "declined"])))
      .returning({ id: s.eventBookings.id, eventId: s.eventBookings.eventId });
    if (done.length) await tx.insert(s.auditLog).values({ clubId, action: "update", entity: "event_booking", entityId: done[0].eventId, after: { paid: done.length, session: sessionId } });
    return done.length;
  });
}

export async function bookingDone(token: unknown, sessionId: string | undefined) {
  const c = verifyLink<BookClaims>("book", token);
  if (!c) return null;
  if (sessionId) await confirmCardPayment(c.c, sessionId).catch((err) => console.error("confirming card payment failed", err));
  return bookingPage(token);
}
