import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { appUrl, sendEmail } from "@/lib/email";
import { disciplineName } from "@/lib/disciplines";
import type { FieldErrors, Result } from "./accounts";
import { WEEKDAYS } from "./classes";
import { clubBySlug } from "./shop";
import { addWebsiteLead } from "./leads";
import { joinPlans } from "./payments";

/*
 * The club website, built and edited in Junbi. It's a stack of sections (big header, text, photo and text,
 * photo gallery, timetable, prices, free-trial form, what members say, join banner, find us) that the club
 * adds, removes, reorders and fills in, in the same clean style as junbi.co.uk. Edits are saved as a draft
 * the club can preview; "Publish" makes them live. The timetable, prices, sites and links always come
 * straight from Junbi. Lives at junbi.co.uk/c/<slug>, or the club's own domain.
 */

/* ---------- Sections ---------- */

const text = (max: number) => z.string().trim().max(max).default("");
const imageId = z.string().uuid().nullable().default(null);
const tone = z.enum(["light", "grey", "dark", "colour"]).default("light");

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().max(40), type: z.literal("hero"), tone, heading: text(120), text: text(300), image: imageId }),
  z.object({ id: z.string().max(40), type: z.literal("text"), tone, heading: text(120), text: text(3000) }),
  z.object({ id: z.string().max(40), type: z.literal("imageText"), tone, heading: text(120), text: text(2000), image: imageId, side: z.enum(["left", "right"]).default("right") }),
  z.object({ id: z.string().max(40), type: z.literal("gallery"), tone, heading: text(120), images: z.array(z.string().uuid()).max(24).default([]) }),
  z.object({ id: z.string().max(40), type: z.literal("timetable"), tone, heading: text(120), text: text(300) }),
  z.object({ id: z.string().max(40), type: z.literal("prices"), tone, heading: text(120), text: text(300) }),
  z.object({ id: z.string().max(40), type: z.literal("trial"), tone, heading: text(120), text: text(300) }),
  z.object({ id: z.string().max(40), type: z.literal("quotes"), tone, heading: text(120), items: z.array(z.object({ quote: text(400), name: text(80) })).max(9).default([]) }),
  z.object({ id: z.string().max(40), type: z.literal("join"), tone, heading: text(120), text: text(300) }),
  z.object({ id: z.string().max(40), type: z.literal("findUs"), tone, heading: text(120) }),
]);
export type Section = z.output<typeof sectionSchema>;
export type SectionType = Section["type"];

/** The sections a club can add, with what they start as. */
export const SECTION_TYPES: Array<{ type: SectionType; label: string; hint: string }> = [
  { type: "hero", label: "Big header", hint: "Your name, a line about you and a photo, with Book a trial and Join buttons" },
  { type: "text", label: "Text", hint: "A heading and a few paragraphs" },
  { type: "imageText", label: "Photo and text", hint: "A photo beside a heading and paragraph" },
  { type: "gallery", label: "Photo gallery", hint: "A grid of photos" },
  { type: "timetable", label: "Timetable", hint: "Your classes, live from Junbi" },
  { type: "prices", label: "Memberships", hint: "Your prices, live from Junbi" },
  { type: "trial", label: "Free trial form", hint: "Families book a trial; it goes straight into Leads" },
  { type: "quotes", label: "What members say", hint: "Quotes from your members and parents" },
  { type: "join", label: "Join banner", hint: "A bold banner with a Join button" },
  { type: "findUs", label: "Find us", hint: "Your sites, addresses and contact details" },
];

export function newSection(type: SectionType, clubName = ""): Section {
  const id = randomUUID().slice(0, 8);
  const base = { id, tone: "light" as const };
  switch (type) {
    case "hero": return { ...base, type, tone: "colour", heading: clubName, text: "", image: null };
    case "text": return { ...base, type, heading: "About us", text: "" };
    case "imageText": return { ...base, type, heading: "", text: "", image: null, side: "right" };
    case "gallery": return { ...base, type, tone: "grey", heading: "Gallery", images: [] };
    case "timetable": return { ...base, type, heading: "Classes", text: "" };
    case "prices": return { ...base, type, tone: "grey", heading: "Memberships", text: "" };
    case "trial": return { ...base, type, heading: "Book a free trial", text: "Come and try a class. Tell us who's training and we'll get you booked in." };
    case "quotes": return { ...base, type, tone: "grey", heading: "What our members say", items: [] };
    case "join": return { ...base, type, tone: "dark", heading: "Ready to start?", text: "Join online in a couple of minutes." };
    case "findUs": return { ...base, type, heading: "Find us" };
  }
}

type Stored = { tagline?: string; about?: string; phone?: string; email?: string; colour?: string; showPrices?: boolean; live?: unknown; draft?: unknown };

/** A club's first website: built from whatever it already told us. */
function defaultSections(clubName: string, st: Stored): Section[] {
  const hero = newSection("hero", clubName) as Extract<Section, { type: "hero" }>;
  hero.text = st.tagline ?? "";
  const out: Section[] = [hero];
  if (st.about) out.push({ ...(newSection("text") as Extract<Section, { type: "text" }>), text: st.about });
  out.push(newSection("timetable"));
  if (st.showPrices !== false) out.push(newSection("prices"));
  out.push(newSection("trial"), newSection("findUs"));
  return out;
}

function parseSections(v: unknown): Section[] | null {
  const p = z.array(sectionSchema).max(40).safeParse(v);
  return p.success ? p.data : null;
}

/* ---------- Settings and the editor ---------- */

const settingsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, "Use lowercase letters, numbers and dashes, e.g. total-combat.")
    .refine((v) => v.length >= 3, "Make it at least 3 characters."),
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

const RESERVED = new Set(["admin", "api", "join", "pay", "book", "family", "shop", "embed", "login", "signup", "settings", "junbi", "img", "site"]);

async function loadStored(actor: Actor) {
  const [c] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.select({ name: s.clubs.name, slug: s.clubs.slug, published: s.clubs.websitePublished, website: s.clubs.website, domain: s.clubs.customDomain }).from(s.clubs).where(eq(s.clubs.id, actor.clubId)),
  );
  return { ...c, stored: (c.website ?? {}) as Stored };
}

export async function websiteSettings(actor: Actor) {
  assertCan(actor, "club.manage");
  const c = await loadStored(actor);
  return { slug: c.slug, published: c.published, settings: c.stored, base: await appUrl() };
}

/** Everything the website editor needs. */
export async function websiteEditor(actor: Actor) {
  assertCan(actor, "club.manage");
  const c = await loadStored(actor);
  const live = parseSections(c.stored.live);
  const draft = parseSections(c.stored.draft) ?? live ?? defaultSections(c.name, c.stored);
  return {
    clubName: c.name,
    slug: c.slug,
    published: c.published,
    domain: c.domain,
    colour: c.stored.colour ?? "#0066cc",
    phone: c.stored.phone ?? "",
    email: c.stored.email ?? "",
    sections: draft,
    unpublishedChanges: JSON.stringify(draft) !== JSON.stringify(live),
    base: await appUrl(),
    types: SECTION_TYPES,
  };
}

/** The address, contact details, colour and on/off switch. */
export async function saveWebsite(actor: Actor, input: WebsiteInput): Promise<Result<{ slug: string }>> {
  assertCan(actor, "club.manage");
  const p = settingsSchema.safeParse(input);
  if (!p.success) {
    const errors: FieldErrors = {};
    for (const i of p.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  if (RESERVED.has(d.slug)) return { ok: false, errors: { slug: "That one's taken. Try another." } };
  const [taken] = (await db().execute(sql`select club_slug_taken(${d.slug}, ${actor.clubId}::uuid) as taken`)) as unknown as Array<{ taken: boolean }>;
  if (taken?.taken) return { ok: false, errors: { slug: "Another club has that address. Try another." } };
  const c = await loadStored(actor);
  const stored: Stored = { ...c.stored, phone: d.phone || undefined, email: d.email || undefined, colour: d.colour ?? c.stored.colour, showPrices: d.showPrices };
  if (d.tagline !== undefined) stored.tagline = d.tagline || undefined;
  if (d.about !== undefined) stored.about = d.about || undefined;
  // Turning the site on for the first time publishes whatever's in the editor.
  if (d.published && !parseSections(stored.live)) stored.live = parseSections(stored.draft) ?? defaultSections(c.name, stored);
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.update(s.clubs).set({ slug: d.slug, website: stored, websitePublished: d.published }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_website", entityId: actor.clubId, after: { slug: d.slug, published: d.published } });
  });
  return { ok: true, value: { slug: d.slug } };
}

/** Saves the sections as a draft (or publishes them). Photos must belong to this club. */
export async function saveSections(actor: Actor, raw: unknown, publish: boolean): Promise<Result<{ sections: number }>> {
  assertCan(actor, "club.manage");
  const sections = parseSections(raw);
  if (!sections) return { ok: false, errors: { form: "Something in the page couldn't be saved. Please refresh and try again." } };
  const images = [...new Set(sections.flatMap((x) => ("image" in x && x.image ? [x.image] : "images" in x ? x.images : [])))];
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    if (images.length) {
      const mine = await tx.select({ id: s.websiteImages.id }).from(s.websiteImages).where(inArray(s.websiteImages.id, images));
      if (mine.length !== images.length) return { ok: false as const, errors: { form: "One of the photos is missing. Please upload it again." } };
    }
    const [c] = await tx.select({ website: s.clubs.website }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const stored = { ...((c.website ?? {}) as Stored), draft: sections, ...(publish ? { live: sections } : {}) };
    await tx.update(s.clubs).set({ website: stored, ...(publish ? { websitePublished: true } : {}) }).where(eq(s.clubs.id, actor.clubId));
    if (publish) await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_website", entityId: actor.clubId, after: { published: true, sections: sections.length } });
    return { ok: true as const, value: { sections: sections.length } };
  });
}

/* ---------- Photos ---------- */

const MAX_BYTES = 1_900_000;

/** Saves a photo the club uploaded (already resized in the browser). Returns its id. */
export async function uploadWebsiteImage(actor: Actor, dataUrl: string, size?: { width: number; height: number }): Promise<Result<{ id: string; url: string }>> {
  assertCan(actor, "club.manage");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) return { ok: false, errors: { form: "That file isn't a photo we can use. Try a JPEG or PNG." } };
  const data = Buffer.from(m[2], "base64");
  if (data.length > MAX_BYTES) return { ok: false, errors: { form: "That photo is too big. Try a smaller one." } };
  // Check it really is the image type it claims to be.
  const sig = data.subarray(0, 12).toString("hex");
  const real = (m[1] === "image/jpeg" && sig.startsWith("ffd8ff")) || (m[1] === "image/png" && sig.startsWith("89504e47")) || (m[1] === "image/webp" && sig.startsWith("52494646") && sig.slice(16, 24) === "57454250");
  if (!real) return { ok: false, errors: { form: "That file isn't a photo we can use. Try a JPEG or PNG." } };
  const small = await shrinkPhoto(data);
  const [row] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx
      .insert(s.websiteImages)
      .values(small
        ? { clubId: actor.clubId, mime: "image/webp", data: small.data, width: small.width, height: small.height }
        : { clubId: actor.clubId, mime: m[1], data, width: size?.width ? Math.round(size.width) : null, height: size?.height ? Math.round(size.height) : null })
      .returning({ id: s.websiteImages.id }),
  );
  return { ok: true, value: { id: row.id, url: `/img/${row.id}` } };
}

/**
 * Re-saves a photo as WebP, at most 1800px, turned the right way up and with its metadata removed (phones put
 * the GPS location in photos). Usually a fraction of the size, so club sites load fast on phones.
 * Returns null if sharp isn't available, and the original is kept instead.
 */
export async function shrinkPhoto(data: Buffer, maxSide = 1800): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data: out, info } = await sharp(data, { failOn: "error" })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data: out, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/** A photo for the public image route. */
export async function websiteImage(id: string): Promise<{ mime: string; data: Buffer } | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [r] = (await db().execute(sql`select * from website_image(${id}::uuid)`)) as unknown as Array<{ mime: string; data: Buffer }>;
  return r ?? null;
}

/* ---------- Own domain ---------- */

const NETLIFY_TARGET = () => process.env.NETLIFY_SITE_DOMAIN || "junbi-demo.netlify.app";
const NETLIFY_IP = "75.2.60.5";

/** Asks Netlify to serve (and get a certificate for) the club's domain. Needs NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID. */
async function netlifyAliases(add: string[], remove: string[]): Promise<boolean> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const site = process.env.NETLIFY_SITE_ID;
  if (!token || !site) return false;
  const api = `https://api.netlify.com/api/v1/sites/${site}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const cur = (await fetch(api, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { domain_aliases?: string[] } | null;
  if (!cur) return false;
  const next = [...new Set([...(cur.domain_aliases ?? []).filter((d) => !remove.includes(d)), ...add])];
  const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify({ domain_aliases: next }) }).catch(() => null);
  return Boolean(res?.ok);
}

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
  .refine((v) => /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(v), "Enter a domain like totalcombat.co.uk.")
  .refine((v) => !/(^|\.)(junbi\.co\.uk|netlify\.app)$/.test(v), "Enter your own domain.");

/** Connects (or, with an empty domain, disconnects) the club's own domain. */
export async function setCustomDomain(actor: Actor, raw: string): Promise<Result<{ domain: string | null; automatic: boolean }>> {
  assertCan(actor, "club.manage");
  const c = await loadStored(actor);
  const old = c.domain;
  if (!raw.trim()) {
    await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.clubs).set({ customDomain: null }).where(eq(s.clubs.id, actor.clubId)));
    if (old) await netlifyAliases([], [old, `www.${old}`]);
    return { ok: true, value: { domain: null, automatic: true } };
  }
  const p = domainSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: { domain: p.error.issues[0].message } };
  const domain = p.data;
  const [taken] = (await db().execute(sql`select club_domain_taken(${domain}, ${actor.clubId}::uuid) as taken`)) as unknown as Array<{ taken: boolean }>;
  if (taken?.taken) return { ok: false, errors: { domain: "That domain is already connected to another club." } };
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.update(s.clubs).set({ customDomain: domain }).where(eq(s.clubs.id, actor.clubId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_domain", entityId: actor.clubId, after: { domain } });
  });
  const automatic = await netlifyAliases([domain, `www.${domain}`], old && old !== domain ? [old, `www.${old}`] : []);
  if (!automatic) {
    // Not set up for automatic connection yet: tell the Junbi team so they can add it by hand.
    const safe = c.name.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    await sendEmail({
      to: process.env.ALERT_EMAIL || "hello@junbi.co.uk",
      subject: `Connect a club domain: ${domain}`,
      html: `<p>${safe} wants to use <b>${domain}</b> (and www.${domain}) for their Junbi website. Add both as domain aliases on the Netlify site, or set NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID so this happens automatically.</p>`,
      text: `${c.name} wants to use ${domain} (and www.${domain}) for their Junbi website. Add both as domain aliases on the Netlify site, or set NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID so this happens automatically.`,
      template: "alert-domain",
      clubId: actor.clubId,
    }).catch(() => undefined);
  }
  return { ok: true, value: { domain, automatic } };
}

/** What to put in the club's DNS, and whether it's pointing at Junbi yet. */
export async function domainStatus(domain: string) {
  const { resolve4, resolveCname } = await import("node:dns/promises");
  const apex = await resolve4(domain).catch(() => [] as string[]);
  const www = await resolveCname(`www.${domain}`).catch(() => [] as string[]);
  return {
    records: [
      { type: "A", name: "@", value: NETLIFY_IP, ok: apex.includes(NETLIFY_IP) },
      { type: "CNAME", name: "www", value: NETLIFY_TARGET(), ok: www.some((w) => w.replace(/\.$/, "") === NETLIFY_TARGET()) },
    ],
  };
}

/** Published club websites, for the sitemap. Empty if the database function isn't there yet. */
export async function publishedClubSites(): Promise<Array<{ slug: string; customDomain: string | null }>> {
  try {
    const rows = (await db().execute(sql`select * from published_club_sites()`)) as unknown as Array<{ slug: string; custom_domain: string | null }>;
    return rows.map((r) => ({ slug: r.slug, customDomain: r.custom_domain }));
  } catch {
    return [];
  }
}

export async function slugForDomain(host: string): Promise<string | null> {
  if (!/^[a-z0-9.-]{4,253}$/i.test(host)) return null;
  const [r] = (await db().execute(sql`select * from club_by_domain(${host.toLowerCase()})`)) as unknown as Array<{ slug: string }>;
  return r?.slug ?? null;
}

/* ---------- The public page ---------- */

const per = (i: string) => (i === "annual" ? "a year" : i === "termly" ? "a term" : "a month");

/** The public club page. Null if the address is wrong or the club hasn't published it (owners can preview the draft). */
export async function clubWebsite(slug: unknown, opts: { preview?: Actor; draft?: boolean } = {}) {
  const club = await clubBySlug(slug);
  if (!club) return null;
  const owner = Boolean(opts.preview && opts.preview.clubId === club.clubId);
  if (!club.published && !owner) return null;
  const base = await appUrl();
  return withClub({ clubId: club.clubId }, async (tx) => {
    const [c] = await tx.select({ website: s.clubs.website, joinToken: s.clubs.joinToken, slug: s.clubs.slug, domain: s.clubs.customDomain }).from(s.clubs).where(eq(s.clubs.id, club.clubId));
    const settings = (c.website ?? {}) as Stored;
    const sections = (owner && opts.draft ? parseSections(settings.draft) : null) ?? parseSections(settings.live) ?? defaultSections(club.clubName, settings);
    const sites = await tx.select({ id: s.sites.id, name: s.sites.name, address: s.sites.address }).from(s.sites).orderBy(asc(s.sites.name));
    const classes = await tx
      .select({ id: s.classes.id, name: s.classes.name, discipline: s.classes.discipline, weekday: s.classes.weekday, startsAt: s.classes.startsAt, durationMinutes: s.classes.durationMinutes, siteId: s.classes.siteId })
      .from(s.classes)
      .where(eq(s.classes.archived, false))
      .orderBy(asc(s.classes.weekday), asc(s.classes.startsAt));
    const arts = (await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true))).map((r) => disciplineName(r.d));
    const plans = await joinPlans(tx);
    const [{ n: products }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.products).where(eq(s.products.active, true));
    const end = (t: string, m: number) => {
      const [h, mm] = t.split(":").map(Number);
      const x = h * 60 + mm + m;
      return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
    };
    return {
      clubName: club.clubName,
      slug: c.slug,
      domain: c.domain,
      published: club.published,
      draft: owner && Boolean(opts.draft),
      sections,
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
      familyUrl: `${base}/family` as string | null,
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
