import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { DISCIPLINES, defaultPreset } from "@/lib/disciplines";
import { SELF_SERVE_IDS } from "@/lib/plans";
import { TRIAL_EXTENSION_DAYS, type Result } from "./accounts";

export async function getClubOverview(actor: Actor) {
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select().from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const disciplines = await tx.select().from(s.clubDisciplines).orderBy(asc(s.clubDisciplines.createdAt));
    const sites = await tx.select().from(s.sites).orderBy(asc(s.sites.name));
    const [{ students }] = await tx
      .select({ students: sql<number>`count(*) filter (where ${s.students.status} in ('active','trial'))::int` })
      .from(s.students);
    const [{ classes }] = await tx
      .select({ classes: sql<number>`count(*) filter (where not ${s.classes.archived})::int` })
      .from(s.classes);
    const staff = (await tx.execute(sql`
      select cs.id, cs.user_id, u.name, u.email, cs.role from club_staff cs join users u on u.id = cs.user_id order by cs.created_at`)) as unknown as Array<{
      id: string;
      user_id: string;
      name: string;
      email: string;
      role: string;
    }>;
    return {
      club,
      activeArts: disciplines.filter((d) => d.active).map((d) => d.discipline),
      interestArts: disciplines.filter((d) => !d.active).map((d) => d.discipline),
      sites,
      activeStudents: students,
      classCount: classes,
      staff,
    };
  });
}

/** Active arts only; drives whether the dashboard shows an art filter. */
export async function clubArts(actor: Actor): Promise<string[]> {
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) =>
    (await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)).orderBy(asc(s.clubDisciplines.createdAt))).map((r) => r.d),
  );
}

export async function renameClub(actor: Actor, name: string): Promise<Result> {
  assertCan(actor, "club.manage");
  const parsed = z.string().trim().min(2, "Enter your club's name.").max(120).safeParse(name);
  if (!parsed.success) return { ok: false, errors: { name: parsed.error.issues[0].message } };
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.clubs).set({ name: parsed.data }).where(eq(s.clubs.id, actor.clubId)));
  return { ok: true, value: undefined };
}

export async function addSite(actor: Actor, name: string, address: string): Promise<Result> {
  assertCan(actor, "classes.manage");
  if (actor.sites !== "all") return { ok: false, errors: { siteName: "Only staff covering every site can add sites." } };
  const n = z.string().trim().min(2, "Enter a site name.").max(80).safeParse(name);
  if (!n.success) return { ok: false, errors: { siteName: n.error.issues[0].message } };
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.insert(s.sites).values({ clubId: actor.clubId, name: n.data, address: address.trim().slice(0, 200) || null }),
  );
  return { ok: true, value: undefined };
}

/**
 * Turn an art on or off. Turning one on loads its default belt system if the club has no grades
 * for it yet. Turning one off hides it but keeps every grade and grading result.
 */
export async function setArt(actor: Actor, discipline: string, on: boolean): Promise<Result> {
  assertCan(actor, "club.manage");
  const d = DISCIPLINES.find((x) => x.id === discipline);
  if (!d) return { ok: false, errors: { form: "Unknown art." } };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    if (!on) {
      const active = await tx.select().from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true));
      if (active.length <= 1 && active[0]?.discipline === discipline) {
        return { ok: false as const, errors: { form: "Your club needs at least one art." } };
      }
      await tx.delete(s.clubDisciplines).where(eq(s.clubDisciplines.discipline, discipline));
      return { ok: true as const, value: undefined };
    }
    await tx
      .insert(s.clubDisciplines)
      .values({ clubId: actor.clubId, discipline, active: true })
      .onConflictDoUpdate({ target: [s.clubDisciplines.clubId, s.clubDisciplines.discipline], set: { active: true } });
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.grades).where(eq(s.grades.discipline, discipline));
    const preset = defaultPreset(discipline);
    if (n === 0 && preset?.grades.length) {
      await tx.insert(s.grades).values(preset.grades.map((g, i) => ({ clubId: actor.clubId, discipline, sortOrder: i, ...g })));
    }
    return { ok: true as const, value: undefined };
  });
}

/** Switch between Starter, Club and Academy. Association is set up with Junbi directly. */
export async function setPlan(actor: Actor, plan: string): Promise<Result> {
  assertCan(actor, "club.manage");
  const parsed = z.enum(SELF_SERVE_IDS).safeParse(plan);
  if (!parsed.success) return { ok: false, errors: { plan: "Choose Starter, Club or Academy." } };
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select({ plan: s.clubs.plan }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    if (club?.plan === "association") return; // managed by Junbi
    await tx.update(s.clubs).set({ plan: parsed.data }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_plan", entityId: actor.clubId, before: { plan: club?.plan }, after: { plan: parsed.data } });
  });
  return { ok: true, value: undefined };
}

/** "Need more time?": adds 14 days to the free trial, once, for clubs still on trial. */
export async function extendTrial(actor: Actor): Promise<Result<{ trialEndsOn: string }>> {
  assertCan(actor, "club.manage");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select({ trialEndsOn: s.clubs.trialEndsOn, trialExtended: s.clubs.trialExtended }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    if (!club?.trialEndsOn) return { ok: false as const, errors: { form: "Your club isn't on a free trial." } };
    if (club.trialExtended) return { ok: false as const, errors: { form: "Your trial has already been extended once. Get in touch if you need longer." } };
    const today = new Date().toISOString().slice(0, 10);
    const from = club.trialEndsOn > today ? club.trialEndsOn : today;
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + TRIAL_EXTENSION_DAYS);
    const trialEndsOn = d.toISOString().slice(0, 10);
    await tx.update(s.clubs).set({ trialEndsOn, trialExtended: true }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_trial", entityId: actor.clubId, before: { trialEndsOn: club.trialEndsOn }, after: { trialEndsOn } });
    return { ok: true as const, value: { trialEndsOn } };
  });
}
