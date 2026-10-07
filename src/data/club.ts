import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { DISCIPLINES } from "@/lib/disciplines";
import type { Result } from "./accounts";

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
      select u.name, u.email, cs.role from club_staff cs join users u on u.id = cs.user_id order by cs.created_at`)) as unknown as Array<{
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

/** Turn an art on, or register interest in one that's coming soon. Turning one off hides it but keeps history. */
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
      await tx.delete(s.clubDisciplines).where(and(eq(s.clubDisciplines.discipline, discipline)));
      return { ok: true as const, value: undefined };
    }
    await tx
      .insert(s.clubDisciplines)
      .values({ clubId: actor.clubId, discipline, active: d.available })
      .onConflictDoUpdate({ target: [s.clubDisciplines.clubId, s.clubDisciplines.discipline], set: { active: d.available } });
    return { ok: true as const, value: undefined };
  });
}
