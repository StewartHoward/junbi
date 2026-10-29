import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { signLink, verifyLink } from "@/lib/payments/crypto";
import { appUrl } from "@/lib/email";
import { disciplineName } from "@/lib/disciplines";

/*
 * The club's live timetable for its own website. The club pastes a short code that loads
 * /embed/timetable/<token> in a frame. It reads the classes straight from Junbi, so it's always up to date.
 * The token only opens the timetable (class names, days, times, sites), nothing else.
 */

const TEN_YEARS = 10 * 365 * 86_400;

export async function timetableEmbed(actor: Actor): Promise<{ token: string; base: string }> {
  assertCan(actor, "classes.manage");
  return { token: signLink("timetable", { c: actor.clubId }, TEN_YEARS), base: await appUrl() };
}

export type PublicTimetable = {
  clubName: string;
  sites: Array<{ id: string; name: string }>;
  multiArt: boolean;
  classes: Array<{ id: string; name: string; art: string; weekday: number; start: string; end: string; siteId: string; site: string }>;
  /** The family sign-up link, only when the club asked for a sign-up button. */
  signupUrl: string | null;
};

const hhmm = (t: string) => t.slice(0, 5);
const plus = (t: string, minutes: number) => {
  const [h, m] = t.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export async function publicTimetable(token: unknown, opts: { signup?: boolean } = {}): Promise<PublicTimetable | null> {
  const claims = verifyLink<{ c: string }>("timetable", token);
  if (!claims) return null;
  return withClub({ clubId: claims.c }, async (tx) => {
    const [club] = await tx.select({ name: s.clubs.name, joinToken: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, claims.c));
    if (!club) return null;
    const rows = await tx
      .select({
        id: s.classes.id,
        name: s.classes.name,
        discipline: s.classes.discipline,
        weekday: s.classes.weekday,
        startsAt: s.classes.startsAt,
        durationMinutes: s.classes.durationMinutes,
        siteId: s.classes.siteId,
        site: s.sites.name,
      })
      .from(s.classes)
      .innerJoin(s.sites, eq(s.sites.id, s.classes.siteId))
      .where(and(eq(s.classes.archived, false)))
      .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt), asc(s.sites.name));
    const sites = [...new Map(rows.map((r) => [r.siteId, { id: r.siteId, name: r.site }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
      clubName: club.name,
      sites,
      multiArt: new Set(rows.map((r) => r.discipline)).size > 1,
      classes: rows.map((r) => ({
        id: r.id,
        name: r.name,
        art: disciplineName(r.discipline),
        weekday: r.weekday,
        start: hhmm(r.startsAt),
        end: plus(r.startsAt, r.durationMinutes),
        siteId: r.siteId,
        site: r.site,
      })),
      signupUrl: opts.signup ? `${await appUrl()}/join/${club.joinToken}` : null,
    };
  });
}
