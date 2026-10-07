import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, canAtSite, ForbiddenError, type Actor } from "@/auth/permissions";
import type { FieldErrors, Result } from "./accounts";

export const CLUB_TZ = "Europe/London";
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Today's date in the club's time zone, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_TZ }).format(now);
}
/** 1 = Monday … 7 = Sunday */
export function isoWeekday(date: string) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
export function validDate(date: string | undefined): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : todayISO();
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const startsAtFor = (date: string, time: string) => sql`((${date}::date + ${time}::time) at time zone ${CLUB_TZ})`;

const visibleSites = (actor: Actor) => (actor.sites === "all" ? undefined : inArray(s.classes.siteId, [...actor.sites]));

export type ClassRow = {
  id: string;
  name: string;
  discipline: string;
  weekday: number;
  startsAt: string;
  durationMinutes: number;
  capacity: number | null;
  siteId: string;
  site: string;
};

export async function listClasses(actor: Actor, opts: { discipline?: string } = {}): Promise<ClassRow[]> {
  assertCan(actor, "register.take");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx
      .select({
        id: s.classes.id,
        name: s.classes.name,
        discipline: s.classes.discipline,
        weekday: s.classes.weekday,
        startsAt: s.classes.startsAt,
        durationMinutes: s.classes.durationMinutes,
        capacity: s.classes.capacity,
        siteId: s.classes.siteId,
        site: s.sites.name,
      })
      .from(s.classes)
      .innerJoin(s.sites, eq(s.sites.id, s.classes.siteId))
      .where(and(eq(s.classes.archived, false), visibleSites(actor), opts.discipline ? eq(s.classes.discipline, opts.discipline) : undefined))
      .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt), asc(s.sites.name)),
  );
}

/** Classes running on a date, with how many have checked in so far. */
export async function classesOn(actor: Actor, date: string, opts: { discipline?: string } = {}) {
  const all = await listClasses(actor, opts);
  const day = all.filter((c) => c.weekday === isoWeekday(date));
  if (!day.length) return [];
  const counts = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({ classId: s.sessions.classId, present: sql<number>`count(${s.attendance.id})::int` })
      .from(s.sessions)
      .innerJoin(s.classes, eq(s.classes.id, s.sessions.classId))
      .leftJoin(s.attendance, eq(s.attendance.sessionId, s.sessions.id))
      .where(
        and(
          inArray(s.sessions.classId, day.map((c) => c.id)),
          sql`${s.sessions.startsAt} = ((${date}::date + ${s.classes.startsAt}) at time zone ${CLUB_TZ})`,
        ),
      )
      .groupBy(s.sessions.classId);
    return new Map(rows.map((r) => [r.classId, r.present]));
  });
  return day.map((c) => ({ ...c, present: counts.get(c.id) ?? 0 }));
}

export const classSchema = z.object({
  name: z.string().trim().min(2, "Give the class a name, e.g. Juniors.").max(80),
  siteId: z.string().uuid("Choose a site."),
  discipline: z.string().min(1).max(40).default("taekwondo"),
  weekday: z.coerce.number().int().min(1).max(7),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:45."),
  durationMinutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(300),
  capacity: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(500)])
    .transform((v) => (v === "" ? null : v))
    .optional(),
});
export type ClassInput = z.input<typeof classSchema>;

function errorsOf(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createClass(actor: Actor, input: ClassInput | Record<string, string>): Promise<Result<{ id: string }>> {
  assertCan(actor, "classes.manage");
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error) };
  const d = parsed.data;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [site] = await tx.select({ id: s.sites.id }).from(s.sites).where(eq(s.sites.id, d.siteId));
    if (!site || !canAtSite(actor, "classes.manage", d.siteId)) return { ok: false as const, errors: { siteId: "Choose a site." } };
    const [disc] = await tx
      .select()
      .from(s.clubDisciplines)
      .where(and(eq(s.clubDisciplines.discipline, d.discipline), eq(s.clubDisciplines.active, true)));
    if (!disc) return { ok: false as const, errors: { discipline: "Choose one of your club's arts." } };
    const [c] = await tx
      .insert(s.classes)
      .values({ clubId: actor.clubId, siteId: d.siteId, discipline: d.discipline, name: d.name, weekday: d.weekday, startsAt: d.startsAt, durationMinutes: d.durationMinutes, capacity: d.capacity ?? null })
      .returning({ id: s.classes.id });
    return { ok: true as const, value: { id: c.id } };
  });
}

export async function archiveClass(actor: Actor, classId: string) {
  assertCan(actor, "classes.manage");
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const c = await classFor(tx, actor, classId, "classes.manage");
    await tx.update(s.classes).set({ archived: true }).where(eq(s.classes.id, c.id));
  });
}

async function classFor(tx: Tx, actor: Actor, classId: string, cap: "register.take" | "classes.manage") {
  if (!z.string().uuid().safeParse(classId).success) throw new ForbiddenError(cap);
  const [c] = await tx
    .select({ id: s.classes.id, name: s.classes.name, siteId: s.classes.siteId, site: s.sites.name, weekday: s.classes.weekday, startsAt: s.classes.startsAt, durationMinutes: s.classes.durationMinutes, discipline: s.classes.discipline })
    .from(s.classes)
    .innerJoin(s.sites, eq(s.sites.id, s.classes.siteId))
    .where(eq(s.classes.id, classId));
  if (!c || !canAtSite(actor, cap, c.siteId)) throw new ForbiddenError(cap);
  return c;
}

async function findSession(tx: Tx, classId: string, date: string, time: string) {
  const [row] = await tx
    .select({ id: s.sessions.id })
    .from(s.sessions)
    .where(and(eq(s.sessions.classId, classId), sql`${s.sessions.startsAt} = ${startsAtFor(date, time)}`));
  return row?.id ?? null;
}

export async function getRegister(actor: Actor, classId: string, date: string) {
  assertCan(actor, "register.take");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const c = await classFor(tx, actor, classId, "register.take");
    const sessionId = await findSession(tx, c.id, date, c.startsAt);
    const present = new Set<string>();
    if (sessionId) {
      const rows = await tx.select({ studentId: s.attendance.studentId }).from(s.attendance).where(eq(s.attendance.sessionId, sessionId));
      rows.forEach((r) => present.add(r.studentId));
    }
    const students = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, status: s.students.status })
      .from(s.students)
      .where(and(eq(s.students.siteId, c.siteId), inArray(s.students.status, ["trial", "active"])))
      .orderBy(asc(s.students.firstName), asc(s.students.lastName));
    return {
      cls: c,
      date,
      runsToday: c.weekday === isoWeekday(date),
      students: students.map((st) => ({ ...st, present: present.has(st.id) })),
      presentCount: present.size,
    };
  });
}

export async function setAttendance(actor: Actor, classId: string, date: string, studentId: string, present: boolean) {
  assertCan(actor, "register.take");
  if (!z.string().uuid().safeParse(studentId).success) throw new ForbiddenError("register.take");
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const c = await classFor(tx, actor, classId, "register.take");
    const [st] = await tx.select({ siteId: s.students.siteId }).from(s.students).where(eq(s.students.id, studentId));
    if (!st) throw new ForbiddenError("register.take");

    await tx
      .insert(s.sessions)
      .values({ clubId: actor.clubId, classId: c.id, startsAt: sql`${startsAtFor(date, c.startsAt)}` as unknown as Date })
      .onConflictDoNothing();
    const sessionId = await findSession(tx, c.id, date, c.startsAt);
    if (!sessionId) throw new Error("Could not open the register");

    if (present) {
      await tx.insert(s.attendance).values({ clubId: actor.clubId, sessionId, studentId, method: "register" }).onConflictDoNothing();
    } else {
      await tx.delete(s.attendance).where(and(eq(s.attendance.sessionId, sessionId), eq(s.attendance.studentId, studentId)));
    }
  });
}
