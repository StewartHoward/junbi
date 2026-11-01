import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { appUrl } from "@/lib/email";
import { disciplineName } from "@/lib/disciplines";
import type { FieldErrors, Result } from "./accounts";
import { WEEKDAYS } from "./classes";
import { clubBySlug } from "./shop";
import { addWebsiteLead } from "./leads";
import { joinPlans } from "./payments";

/*
 * The club website: a simple, good-looking public page built from the club's own Junbi details at
 * junbi.co.uk/c/<slug>. Timetable, sites, prices, a free-trial form that goes straight into Leads, the
 * sign-up link, the shop and the parent login. The club writes a tagline and a few lines about itself,
 * picks a colour and publishes it.
 */

export type WebsiteSettings = { tagline?: string; about?: string; phone?: string; email?: string; colour?: string; showPrices?: boolean };

const RESERVED = new Set(["admin", "api", "join", "pay", "book", "family", "shop", "embed", "login", "signup", "settings", "junbi"]);

const settingsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, "Use lowercase letters, numbers and dashes, e.g. total-combat.")
    .refine((v) => v.length >= 3, "Make it at least 3 characters.")
    .refine((v) => !RESERVED.has(v), "That one's taken. Try another."),
  tagline: z.string().trim().max(120).optional(),
  about: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address."),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  showPrices: z.boolean().default(true),
  published: z.boolean().default(false),
});
export type WebsiteInput = z.input<typeof settingsSchema>;

export async function websiteSettings(actor: Actor) {
  assertCan(actor, "club.manage");
  const [c] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.select({ slug: s.clubs.slug, published: s.clubs.websitePublished, website: s.clubs.website }).from(s.clubs).where(eq(s.clubs.id, actor.clubId)),
  );
  return { slug: c.slug, published: c.published, settings: (c.website ?? {}) as WebsiteSettings, base: await appUrl() };
}

export async function saveWebsite(actor: Actor, input: WebsiteInput): Promise<Result<{ slug: string }>> {
  assertCan(actor, "club.manage");
  const p = settingsSchema.safeParse(input);
  if (!p.success) {
    const errors: FieldErrors = {};
    for (const i of p.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  const [taken] = (await db().execute(sql`select club_slug_taken(${d.slug}, ${actor.clubId}::uuid) as taken`)) as unknown as Array<{ taken: boolean }>;
  if (taken?.taken) return { ok: false, errors: { slug: "Another club has that address. Try another." } };
  const website: WebsiteSettings = { tagline: d.tagline || undefined, about: d.about || undefined, phone: d.phone || undefined, email: d.email || undefined, colour: d.colour, showPrices: d.showPrices };
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.update(s.clubs).set({ slug: d.slug, website, websitePublished: d.published }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_website", entityId: actor.clubId, after: { slug: d.slug, published: d.published } });
  });
  return { ok: true, value: { slug: d.slug } };
}

const per = (i: string) => (i === "annual" ? "a year" : i === "termly" ? "a term" : "a month");

/** The public club page. Null if the address is wrong or the club hasn't published it (owners can preview). */
export async function clubWebsite(slug: unknown, opts: { preview?: Actor } = {}) {
  const club = await clubBySlug(slug);
  if (!club) return null;
  if (!club.published && !(opts.preview && opts.preview.clubId === club.clubId)) return null;
  const base = await appUrl();
  return withClub({ clubId: club.clubId }, async (tx) => {
    const [c] = await tx.select({ website: s.clubs.website, joinToken: s.clubs.joinToken, slug: s.clubs.slug }).from(s.clubs).where(eq(s.clubs.id, club.clubId));
    const settings = (c.website ?? {}) as WebsiteSettings;
    const sites = await tx.select({ id: s.sites.id, name: s.sites.name, address: s.sites.address }).from(s.sites).orderBy(asc(s.sites.name));
    const classes = await tx
      .select({ id: s.classes.id, name: s.classes.name, discipline: s.classes.discipline, weekday: s.classes.weekday, startsAt: s.classes.startsAt, durationMinutes: s.classes.durationMinutes, siteId: s.classes.siteId })
      .from(s.classes)
      .where(eq(s.classes.archived, false))
      .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt));
    const arts = (await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true))).map((r) => disciplineName(r.d));
    const plans = settings.showPrices === false ? null : await joinPlans(tx);
    const [{ n: products }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.products).where(eq(s.products.active, true));
    const end = (t: string, m: number) => {
      const [h, mm] = t.split(":").map(Number);
      const x = h * 60 + mm + m;
      return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
    };
    return {
      clubName: club.clubName,
      slug: c.slug,
      published: club.published,
      tagline: settings.tagline ?? null,
      about: settings.about ?? null,
      phone: settings.phone ?? null,
      email: settings.email ?? null,
      colour: settings.colour ?? "#0066cc",
      arts,
      sites,
      timetable: WEEKDAYS.map((day, i) => ({
        day,
        classes: classes
          .filter((x) => x.weekday === i + 1)
          .map((x) => ({ id: x.id, name: x.name, time: `${x.startsAt.slice(0, 5)} to ${end(x.startsAt, x.durationMinutes)}`, site: sites.length > 1 ? sites.find((st) => st.id === x.siteId)?.name ?? null : null, art: arts.length > 1 ? disciplineName(x.discipline) : null })),
      })).filter((d) => d.classes.length),
      trialClasses: classes.map((x) => ({ id: x.id, weekday: x.weekday, label: `${WEEKDAYS[x.weekday - 1]} ${x.startsAt.slice(0, 5)}, ${x.name}${sites.length > 1 ? ` (${sites.find((st) => st.id === x.siteId)?.name})` : ""}` })),
      prices: plans?.plans.map((p) => ({ name: p.name, price: `£${(p.amountPence / 100).toFixed(p.amountPence % 100 ? 2 : 0)} ${per(p.interval)}` })) ?? [],
      signupFee: plans?.signupFeePence ? `£${(plans.signupFeePence / 100).toFixed(2)}` : null,
      signupUrl: `${base}/join/${c.joinToken}`,
      shopUrl: products > 0 ? `${base}/c/${c.slug}/shop` : null,
      familyUrl: `${base}/family`,
    };
  });
}

export async function websiteTrial(slug: unknown, input: { firstName: string; lastName: string; email: string; phone: string; studentName: string; studentAge: string; classId: string; sessionDate: string }) {
  const club = await clubBySlug(slug);
  if (!club || !club.published) return { ok: false as const, errors: { form: "This page isn't available." } as FieldErrors };
  return addWebsiteLead(club.clubId, { ...input, siteId: undefined, sessionTime: undefined, notes: undefined });
}

/** Whether the shop has anything for sale, for the parent home page link. */
export async function shopLinkFor(clubId: string) {
  return withClub({ clubId }, async (tx) => {
    const [c] = await tx.select({ slug: s.clubs.slug }).from(s.clubs).where(eq(s.clubs.id, clubId));
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.products).where(and(eq(s.products.active, true)));
    return n > 0 && c ? `${await appUrl()}/c/${c.slug}/shop` : null;
  });
}
