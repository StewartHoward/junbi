import "server-only";
import { cookies } from "next/headers";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { signLink, verifyLink } from "@/lib/payments/crypto";
import { appUrl, sendEmail, templates } from "@/lib/email";
import { formatPence } from "./students";
import { CLUB_TZ, WEEKDAYS } from "./classes";
import type { FieldErrors, Result } from "./accounts";
import { shopLinkFor } from "./website";

/*
 * Parent login. Parents sign in with a link emailed to the address the club has for them (no password to
 * forget). They see their children's belts, classes, plans and payments, book gradings and events they've
 * been invited to, and keep their contact details up to date. A parent in more than one club sees each.
 */

export const FAMILY_COOKIE = "junbi_family";
const SESSION_DAYS = 30;
const LINK_MINUTES = 30;

type Household = { club_id: string; club_name: string; household_id: string; guardian_id: string; first_name: string };

async function householdsFor(email: string): Promise<Household[]> {
  return (await db().execute(sql`select * from family_households(${email})`)) as unknown as Household[];
}

const emailSchema = z.string().trim().toLowerCase().email("Enter the email address the club has for you.").max(200);

/** Emails a sign-in link if the club has this email. Says the same either way, so nobody can test which emails are known. */
export async function sendFamilyLink(raw: string): Promise<Result<{ email: string }>> {
  const e = emailSchema.safeParse(raw);
  if (!e.success) return { ok: false, errors: { email: e.error.issues[0].message } };
  const found = await householdsFor(e.data);
  if (found.length) {
    const token = signLink("family-login", { email: e.data }, LINK_MINUTES * 60);
    const t = templates.familyLogin(found[0].first_name, [...new Set(found.map((h) => h.club_name))], `${await appUrl()}/family/in?token=${encodeURIComponent(token)}`);
    await sendEmail({ to: e.data, ...t, template: "family-login", clubId: found[0].club_id });
  }
  return { ok: true, value: { email: e.data } };
}

/** Swaps the emailed link for a 30-day sign-in. */
export async function startFamilySession(token: unknown): Promise<boolean> {
  const c = verifyLink<{ email: string }>("family-login", token);
  if (!c || !(await householdsFor(c.email)).length) return false;
  (await cookies()).set(FAMILY_COOKIE, signLink("family-session", { email: c.email }, SESSION_DAYS * 86_400), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return true;
}

export async function endFamilySession() {
  (await cookies()).delete(FAMILY_COOKIE);
}

/** The signed-in parent's email, or null. */
export async function familyEmail(): Promise<string | null> {
  const c = verifyLink<{ email: string }>("family-session", (await cookies()).get(FAMILY_COOKIE)?.value);
  return c?.email ?? null;
}

const fmtWhen = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: CLUB_TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(" at ", ", ");
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const per = (interval: string) => (interval === "annual" ? "a year" : interval === "termly" ? "a term" : "a month");

/** Everything the parent's home page shows, one block per club they're in. */
export async function familyOverview(email: string) {
  const found = await householdsFor(email);
  const base = await appUrl();
  const out = [];
  for (const h of found) {
    out.push(
      await withClub({ clubId: h.club_id }, async (tx) => {
        const [house] = await tx.select().from(s.households).where(eq(s.households.id, h.household_id));
        const [me] = await tx.select().from(s.guardians).where(eq(s.guardians.id, h.guardian_id));
        const kids = await tx
          .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, status: s.students.status, siteId: s.students.siteId, site: s.sites.name, medicalNotes: s.students.medicalNotes })
          .from(s.students)
          .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
          .where(and(eq(s.students.householdId, h.household_id), ne(s.students.status, "cancelled")))
          .orderBy(asc(s.students.firstName));
        const ids = kids.map((k) => k.id);

        // Current belt in each art: the latest passing result.
        const results = ids.length
          ? await tx
              .select({ studentId: s.gradingResults.studentId, grade: s.grades.name, beltColour: s.grades.beltColour, discipline: s.grades.discipline, gradedOn: s.gradingResults.gradedOn })
              .from(s.gradingResults)
              .innerJoin(s.grades, eq(s.grades.id, s.gradingResults.gradeId))
              .where(and(inArray(s.gradingResults.studentId, ids), ne(s.gradingResults.outcome, "fail")))
              .orderBy(asc(s.gradingResults.gradedOn), asc(s.grades.sortOrder))
          : [];
        const belts = new Map<string, Map<string, { grade: string; beltColour: string; gradedOn: string }>>();
        for (const r of results) {
          const m = belts.get(r.studentId) ?? new Map();
          m.set(r.discipline, { grade: r.grade, beltColour: r.beltColour, gradedOn: r.gradedOn });
          belts.set(r.studentId, m);
        }
        const recent = ids.length
          ? await tx
              .select({ studentId: s.attendance.studentId, n: sql<number>`count(*)::int` })
              .from(s.attendance)
              .innerJoin(s.sessions, eq(s.sessions.id, s.attendance.sessionId))
              .where(and(inArray(s.attendance.studentId, ids), gt(s.sessions.startsAt, new Date(Date.now() - 28 * 86_400_000))))
              .groupBy(s.attendance.studentId)
          : [];
        const plans = ids.length
          ? await tx
              .select({ studentId: s.memberships.studentId, name: s.plans.name, amountPence: s.plans.amountPence, interval: s.plans.interval, startsOn: s.memberships.startsOn })
              .from(s.memberships)
              .innerJoin(s.plans, eq(s.plans.id, s.memberships.planId))
              .where(and(inArray(s.memberships.studentId, ids), eq(s.memberships.status, "active")))
          : [];
        const siteIds = [...new Set(kids.map((k) => k.siteId))];
        const timetable = siteIds.length
          ? await tx
              .select({ name: s.classes.name, weekday: s.classes.weekday, startsAt: s.classes.startsAt, siteId: s.classes.siteId })
              .from(s.classes)
              .where(and(inArray(s.classes.siteId, siteIds), eq(s.classes.archived, false)))
              .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt))
          : [];
        const invites = ids.length
          ? await tx
              .select({ eventId: s.events.id, title: s.events.title, startsAt: s.events.startsAt, status: s.eventBookings.status, firstName: s.students.firstName })
              .from(s.eventBookings)
              .innerJoin(s.events, eq(s.events.id, s.eventBookings.eventId))
              .innerJoin(s.students, eq(s.students.id, s.eventBookings.studentId))
              .where(and(inArray(s.eventBookings.studentId, ids), eq(s.events.cancelled, false), gt(s.events.startsAt, new Date()), inArray(s.eventBookings.status, ["invited", "pending", "booked", "paid"])))
              .orderBy(asc(s.events.startsAt))
          : [];
        const byEvent = new Map<string, { title: string; when: string; open: string[]; going: string[]; url: string }>();
        for (const i of invites) {
          const ev = byEvent.get(i.eventId) ?? {
            title: i.title,
            when: fmtWhen(i.startsAt),
            open: [],
            going: [],
            url: `${base}/book/${signLink("book", { c: h.club_id, e: i.eventId, h: h.household_id }, Math.max(3600, Math.floor((i.startsAt.getTime() - Date.now()) / 1000) + 86_400))}`,
          };
          (i.status === "booked" || i.status === "paid" ? ev.going : ev.open).push(i.firstName);
          byEvent.set(i.eventId, ev);
        }
        const [mandate] = await tx
          .select({ status: s.mandates.status })
          .from(s.mandates)
          .where(eq(s.mandates.householdId, h.household_id))
          .orderBy(sql`case when ${s.mandates.status} in ('active', 'submitted', 'pending_submission') then 0 else 1 end`, desc(s.mandates.createdAt))
          .limit(1);
        const payments = await tx
          .select({ id: s.payments.id, chargeDate: s.payments.chargeDate, description: s.payments.description, amountPence: s.payments.amountPence, status: s.payments.status })
          .from(s.payments)
          .where(eq(s.payments.householdId, h.household_id))
          .orderBy(desc(s.payments.chargeDate))
          .limit(12);

        return {
          clubId: h.club_id,
          clubName: h.club_name,
          shopUrl: await shopLinkFor(h.club_id),
          householdId: h.household_id,
          me: { firstName: me?.firstName ?? h.first_name, phone: me?.phone ?? "" },
          contact: {
            addressLine1: house?.addressLine1 ?? "",
            addressLine2: house?.addressLine2 ?? "",
            town: house?.town ?? "",
            postcode: house?.postcode ?? "",
            emergencyName: house?.emergencyName ?? "",
            emergencyPhone: house?.emergencyPhone ?? "",
          },
          children: kids.map((k) => ({
            id: k.id,
            name: `${k.firstName} ${k.lastName}`,
            firstName: k.firstName,
            site: k.site,
            pending: k.status === "pending",
            belts: [...(belts.get(k.id)?.values() ?? [])].map((b) => ({ ...b, gradedOn: fmtDate(b.gradedOn) })),
            classesLast4Weeks: recent.find((r) => r.studentId === k.id)?.n ?? 0,
            plan: plans.filter((p) => p.studentId === k.id).map((p) => `${p.name}, ${formatPence(p.amountPence)} ${per(p.interval)}`)[0] ?? null,
            classes: timetable.filter((c) => c.siteId === k.siteId).map((c) => `${WEEKDAYS[c.weekday - 1]} ${c.startsAt.slice(0, 5)}, ${c.name}`),
            medicalNotes: k.medicalNotes ?? "",
          })),
          events: [...byEvent.values()],
          directDebit: mandate?.status ?? null,
          payments: payments.map((p) => ({ ...p, chargeDate: fmtDate(p.chargeDate), amount: formatPence(p.amountPence) })),
        };
      }),
    );
  }
  return out;
}

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const detailsSchema = z.object({
  phone: z.string().trim().max(40).refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a phone number the club can reach you on."),
  addressLine1: opt(120),
  addressLine2: opt(120),
  town: opt(80),
  postcode: opt(12).transform((v) => v?.toUpperCase() ?? null),
  emergencyName: opt(80),
  emergencyPhone: opt(40),
  medical: z.record(z.string(), z.string().trim().max(2000)).default({}),
});

/** The parent updates their phone, the family's address and emergency contact, and their children's medical notes. */
export async function updateFamilyDetails(email: string, clubId: string, householdId: string, input: z.input<typeof detailsSchema>): Promise<Result> {
  const mine = (await householdsFor(email)).find((h) => h.club_id === clubId && h.household_id === householdId);
  if (!mine) return { ok: false, errors: { form: "Please sign in again." } };
  const p = detailsSchema.safeParse(input);
  if (!p.success) {
    const errors: FieldErrors = {};
    for (const i of p.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  await withClub({ clubId }, async (tx) => {
    await tx.update(s.guardians).set({ phone: d.phone }).where(eq(s.guardians.id, mine.guardian_id));
    await tx
      .update(s.households)
      .set({ addressLine1: d.addressLine1, addressLine2: d.addressLine2, town: d.town, postcode: d.postcode, emergencyName: d.emergencyName, emergencyPhone: d.emergencyPhone })
      .where(eq(s.households.id, householdId));
    const kids = await tx.select({ id: s.students.id }).from(s.students).where(eq(s.students.householdId, householdId));
    for (const k of kids) {
      if (d.medical[k.id] === undefined) continue;
      await tx.update(s.students).set({ medicalNotes: d.medical[k.id] || null }).where(eq(s.students.id, k.id));
    }
    await tx.insert(s.auditLog).values({ clubId, action: "update", entity: "household", entityId: householdId, after: { by: "parent" } });
  });
  return { ok: true, value: undefined };
}
