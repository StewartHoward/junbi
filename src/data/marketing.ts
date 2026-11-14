import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { appUrl, emailConfigured, sendBatch, sendEmail, type BatchEmail } from "@/lib/email";
import { parseCsv } from "@/lib/import";
import { signLink, verifyLink } from "@/lib/payments/crypto";
import { SOURCES, reasonFor, renderMarketingEmail, type MarketingContent } from "@/lib/marketing-email";
import { TRIAL_SEQUENCE, templateByKey } from "@/lib/marketing-templates";
import type { Result } from "./accounts";

/*
 * Admin → Marketing: Junbi's own emails to clubs.
 *
 * Prospects are clubs found in public directories (or added by hand). Campaigns are written in the email creator,
 * tested, then sent a few at a time: at most the campaign's daily limit, spread across weekday working hours by the
 * hourly job, so a new sending domain builds a good reputation instead of landing in spam.
 *
 * Every email carries an unsubscribe link and a one-click List-Unsubscribe header. Nobody is emailed if they've
 * unsubscribed here or from the Library, already use Junbi, are on trial, or told us they're not interested.
 */

const UNSUB_TTL = 60 * 60 * 24 * 365 * 5;
const FROM_NAME = "Stewart at Junbi";
const SOURCE_KEYS = SOURCES.map((s) => s.key) as [string, ...string[]];

export type ProspectStatus = "active" | "unsubscribed" | "bounced" | "do_not_email";
export const PROSPECT_STATUSES: Array<{ key: ProspectStatus; label: string }> = [
  { key: "active", label: "Can email" },
  { key: "unsubscribed", label: "Unsubscribed" },
  { key: "bounced", label: "Bounced" },
  { key: "do_not_email", label: "Do not email" },
];

const text = (max: number) => z.string().trim().max(max);
const errorsOf = (e: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
};

/* ---------- Who gets a campaign ---------- */

type CampaignRow = {
  id: string; name: string; subject: string; preheader: string; heading: string; body: string; button_label: string; button_url: string;
  audience_style: "all" | "WT" | "ITF"; audience_source: string; follows_campaign_id: string | null; delay_days: number; daily_limit: number;
  status: "draft" | "sending" | "paused" | "sent"; test_sent_at: Date | null; started_at: Date | null; finished_at: Date | null; created_at: Date; updated_at: Date;
};

/**
 * Prospects this campaign can still go to right now. A follow-up only goes to people the earlier email reached,
 * once the gap has passed. The suppression checks live here, in one place, so the count on screen and the sends agree.
 */
const eligible = (c: Pick<CampaignRow, "id" | "audience_style" | "audience_source" | "follows_campaign_id" | "delay_days">) => sql`
  p.status = 'active'
  and (${c.audience_style} = 'all' or p.style = ${c.audience_style})
  and (${c.audience_source} = '' or p.source = ${c.audience_source})
  and not exists (select 1 from mkt_sends s where s.campaign_id = ${c.id}::uuid and s.prospect_id = p.id)
  and not exists (select 1 from crm_contacts cc where cc.email = p.email
    and (cc.unsubscribed_at is not null or cc.signed_up_club is not null or cc.stage in ('trial', 'customer', 'not_interested')))
  and not mkt_is_junbi_staff(p.email)
  and (${c.follows_campaign_id}::uuid is null or exists (
    select 1 from mkt_sends f where f.campaign_id = ${c.follows_campaign_id}::uuid and f.prospect_id = p.id and f.status = 'sent'
      and f.sent_at <= now() - make_interval(days => ${c.delay_days}::int)))`;

/** Everyone who would get it eventually, ignoring the follow-up wait (for the "will go to" number). */
type AudienceRef = { id: unknown; audience_style: unknown; audience_source: unknown; follows_campaign_id: unknown };
const reachable = (c: AudienceRef) => sql`
  p.status = 'active'
  and (${c.audience_style} = 'all' or p.style = ${c.audience_style})
  and (${c.audience_source} = '' or p.source = ${c.audience_source})
  and not exists (select 1 from mkt_sends s where s.campaign_id = ${c.id}::uuid and s.prospect_id = p.id)
  and not exists (select 1 from crm_contacts cc where cc.email = p.email
    and (cc.unsubscribed_at is not null or cc.signed_up_club is not null or cc.stage in ('trial', 'customer', 'not_interested')))
  and not mkt_is_junbi_staff(p.email)
  and (${c.follows_campaign_id}::uuid is null or exists (
    select 1 from mkt_sends f where f.campaign_id = ${c.follows_campaign_id}::uuid and f.prospect_id = p.id and f.status = 'sent'))`;

/** Start of today in the UK, so "sent today" matches Stewart's day rather than UTC. */
const ukToday = sql`(date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London')`;

const contentOf = (c: CampaignRow): MarketingContent => ({ subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url });

async function campaignRow(id: string): Promise<CampaignRow | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [c] = (await db().execute(sql`select * from mkt_campaigns where id = ${id}::uuid`)) as unknown as CampaignRow[];
  return c ?? null;
}

/* ---------- Overview ---------- */

export async function marketingOverview(f: { q?: string; style?: string; source?: string; status?: string } = {}) {
  await requireSuperAdmin();
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 100);
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const style = f.style === "WT" || f.style === "ITF" ? f.style : null;
  const source = SOURCE_KEYS.includes(f.source ?? "") ? f.source! : null;
  const status = PROSPECT_STATUSES.some((s) => s.key === f.status) ? f.status! : null;

  const prospects = (await db().execute(sql`
    select id, email, club_name, contact_name, phone, website, town, region, style, organisation, source, venues, status, emails_sent, last_emailed_at
    from mkt_prospects p
    where (${q} = '' or lower(p.email) like ${like} or lower(p.club_name) like ${like} or lower(p.town) like ${like})
      and (${style}::text is null or p.style = ${style})
      and (${source}::text is null or p.source = ${source})
      and (${status}::text is null or p.status = ${status})
    order by lower(p.club_name), p.email limit 500`)) as unknown as Array<{
    id: string; email: string; club_name: string; contact_name: string; phone: string; website: string; town: string; region: string; style: string;
    organisation: string; source: string; venues: number; status: ProspectStatus; emails_sent: number; last_emailed_at: Date | null;
  }>;

  const [counts] = (await db().execute(sql`
    select count(*)::int as total,
      count(*) filter (where status = 'active')::int as active,
      count(*) filter (where status = 'unsubscribed')::int as unsubscribed,
      count(*) filter (where style = 'WT')::int as wt,
      count(*) filter (where style = 'ITF')::int as itf,
      (select count(*)::int from mkt_sends where status = 'sent') as sent
    from mkt_prospects`)) as unknown as Array<{ total: number; active: number; unsubscribed: number; wt: number; itf: number; sent: number }>;

  const campaigns = (await db().execute(sql`
    select c.id, c.name, c.subject, c.status, c.audience_style, c.daily_limit, c.delay_days, c.follows_campaign_id, c.created_at, c.started_at, c.finished_at,
      (select name from mkt_campaigns f where f.id = c.follows_campaign_id) as follows_name,
      (select count(*)::int from mkt_sends s where s.campaign_id = c.id and s.status = 'sent') as sent,
      (select count(*)::int from mkt_sends s where s.campaign_id = c.id and s.status = 'failed') as failed,
      (select count(*)::int from mkt_prospects p where ${reachable({ id: sql`c.id`, audience_style: sql`c.audience_style`, audience_source: sql`c.audience_source`, follows_campaign_id: sql`c.follows_campaign_id` })}) as remaining
    from mkt_campaigns c order by date_trunc('minute', c.created_at) desc, c.name limit 100`)) as unknown as Array<{
    id: string; name: string; subject: string; status: CampaignRow["status"]; audience_style: string; daily_limit: number; delay_days: number;
    follows_campaign_id: string | null; follows_name: string | null; created_at: Date; started_at: Date | null; finished_at: Date | null; sent: number; failed: number; remaining: number;
  }>;

  return {
    counts: counts ?? { total: 0, active: 0, unsubscribed: 0, wt: 0, itf: 0, sent: 0 },
    prospects: prospects.map((p) => ({
      id: p.id, email: p.email, clubName: p.club_name, contactName: p.contact_name, phone: p.phone, website: p.website, town: p.town, region: p.region,
      style: p.style, organisation: p.organisation, source: p.source, venues: p.venues, status: p.status, emailsSent: p.emails_sent, lastEmailed: p.last_emailed_at ? new Date(p.last_emailed_at) : null,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id, name: c.name || "Untitled email", subject: c.subject, status: c.status, audienceStyle: c.audience_style, dailyLimit: c.daily_limit,
      delayDays: c.delay_days, followsName: c.follows_name, sent: c.sent, failed: c.failed, remaining: c.remaining,
      createdAt: new Date(c.created_at), finishedAt: c.finished_at ? new Date(c.finished_at) : null,
    })),
  };
}

/* ---------- Prospects ---------- */

const prospectSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  clubName: text(160),
  contactName: text(100),
  phone: text(40),
  website: text(300),
  town: text(80),
  region: text(80),
  style: z.enum(["", "WT", "ITF"]).catch(""),
  organisation: text(120),
  source: z.enum(SOURCE_KEYS).catch("manual"),
});
type ProspectInput = z.input<typeof prospectSchema>;

/** Header names we understand in an imported CSV (lower case, spaces ignored). */
const COLUMNS: Record<keyof ProspectInput | "venues", string[]> = {
  email: ["email", "emailaddress", "e-mail"],
  clubName: ["club", "clubname", "name"],
  contactName: ["contact", "contactname", "instructor", "firstname"],
  phone: ["phone", "telephone", "tel", "mobile"],
  website: ["website", "web", "url", "site"],
  town: ["town", "city", "town/city"],
  region: ["region", "county", "area"],
  style: ["style", "wt/itf", "type"],
  organisation: ["organisation", "organization", "association", "body"],
  source: ["source", "sourcekey"],
  venues: ["venues", "clubs", "listings"],
};

const styleOf = (raw: string) => {
  const s = raw.trim().toUpperCase();
  if (/^(WT|WTF|WORLD|KUKKIWON|OLYMPIC)/.test(s)) return "WT" as const;
  if (/^(ITF|CHANG|TAEKWON-DO)/.test(s)) return "ITF" as const;
  return "" as const;
};

const sourceOf = (raw: string) => {
  const s = raw.trim().toLowerCase();
  return SOURCES.find((x) => x.key === s || x.label.toLowerCase() === s)?.key ?? (s.includes("council") || s === "btc" ? "btc" : s.includes("british taekwondo") ? "british-taekwondo" : "");
};

/**
 * Adds prospects from a CSV (with a header row). One row per email: if the same address appears more than once
 * (one instructor with several venues), it's counted as several venues. Existing prospects are filled in, never
 * re-subscribed, and their status is never changed by an import.
 */
export async function importProspects(csv: string, defaults: { source: string; style: string }): Promise<Result<{ added: number; updated: number; skipped: number }>> {
  await requireSuperAdmin();
  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim()));
  if (rows.length < 2) return { ok: false, errors: { csv: "Paste a CSV with a header row and at least one club." } };
  if (rows.length > 5001) return { ok: false, errors: { csv: "That's more than 5,000 rows. Split it into smaller files." } };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const col = (k: keyof typeof COLUMNS) => head.findIndex((h) => COLUMNS[k].includes(h));
  const at = Object.fromEntries((Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>).map((k) => [k, col(k)])) as Record<keyof typeof COLUMNS, number>;
  if (at.email < 0) return { ok: false, errors: { csv: "We couldn't find an Email column. Name one of the columns Email." } };
  const defSource = SOURCE_KEYS.includes(defaults.source) ? defaults.source : "manual";
  const defStyle = styleOf(defaults.style);

  const byEmail = new Map<string, z.output<typeof prospectSchema> & { venues: number }>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (k: keyof typeof COLUMNS) => (at[k] >= 0 ? (r[at[k]] ?? "").trim() : "");
    // A cell may hold more than one address ("a@x.com; b@y.com"): take the first.
    const email = get("email").split(/[;,\s]+/).find((e) => e.includes("@")) ?? "";
    const p = prospectSchema.safeParse({
      email, clubName: get("clubName"), contactName: get("contactName"), phone: get("phone"), website: get("website"), town: get("town"), region: get("region"),
      style: styleOf(get("style")) || defStyle, organisation: get("organisation"), source: sourceOf(get("source")) || defSource,
    });
    if (!p.success) {
      skipped++;
      continue;
    }
    const venues = Math.max(1, Number.parseInt(get("venues"), 10) || 1);
    const prev = byEmail.get(p.data.email);
    if (prev) {
      prev.venues += venues;
      for (const k of ["contactName", "phone", "website", "town", "region", "organisation", "style"] as const) if (!prev[k] && p.data[k]) (prev as unknown as Record<string, string>)[k] = p.data[k];
      // Keep the shortest club name: "Allen Taekwondo Academy" rather than "Allen Taekwondo Academy 42.006".
      if (p.data.clubName && (!prev.clubName || p.data.clubName.length < prev.clubName.length)) prev.clubName = p.data.clubName;
    } else byEmail.set(p.data.email, { ...p.data, venues });
  }

  let added = 0;
  let updated = 0;
  for (const p of byEmail.values()) {
    const [r] = (await db().execute(sql`
      insert into mkt_prospects (email, club_name, contact_name, phone, website, town, region, style, organisation, source, venues)
      values (${p.email}, ${p.clubName}, ${p.contactName}, ${p.phone}, ${p.website}, ${p.town}, ${p.region}, ${p.style}, ${p.organisation}, ${p.source}, ${p.venues})
      on conflict (email) do update set
        club_name = coalesce(nullif(mkt_prospects.club_name, ''), excluded.club_name),
        contact_name = coalesce(nullif(mkt_prospects.contact_name, ''), excluded.contact_name),
        phone = coalesce(nullif(mkt_prospects.phone, ''), excluded.phone),
        website = coalesce(nullif(mkt_prospects.website, ''), excluded.website),
        town = coalesce(nullif(mkt_prospects.town, ''), excluded.town),
        region = coalesce(nullif(mkt_prospects.region, ''), excluded.region),
        style = coalesce(nullif(mkt_prospects.style, ''), excluded.style),
        organisation = coalesce(nullif(mkt_prospects.organisation, ''), excluded.organisation),
        venues = greatest(mkt_prospects.venues, excluded.venues),
        updated_at = now()
      returning (xmax = 0) as inserted`)) as unknown as Array<{ inserted: boolean }>;
    if (r?.inserted) added++;
    else updated++;
  }
  return { ok: true, value: { added, updated, skipped } };
}

export async function addProspect(raw: ProspectInput): Promise<Result<{ id: string }>> {
  await requireSuperAdmin();
  const p = prospectSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: errorsOf(p.error) };
  const d = p.data;
  const rows = (await db().execute(sql`
    insert into mkt_prospects (email, club_name, contact_name, phone, website, town, region, style, organisation, source)
    values (${d.email}, ${d.clubName}, ${d.contactName}, ${d.phone}, ${d.website}, ${d.town}, ${d.region}, ${d.style}, ${d.organisation}, ${d.source})
    on conflict (email) do nothing returning id`)) as unknown as Array<{ id: string }>;
  if (!rows.length) return { ok: false, errors: { email: "That email is already on the list." } };
  return { ok: true, value: { id: rows[0].id } };
}

/** Stop (or allow again) emails to one prospect. Someone who unsubscribed can only be re-added if they ask. */
export async function setProspectStatus(id: string, status: ProspectStatus): Promise<Result> {
  await requireSuperAdmin();
  if (!z.string().uuid().safeParse(id).success || !PROSPECT_STATUSES.some((s) => s.key === status)) return { ok: false, errors: { form: "Unknown prospect." } };
  await db().execute(sql`
    update mkt_prospects set status = ${status}, updated_at = now(),
      unsubscribed_at = case when ${status} = 'unsubscribed' then coalesce(unsubscribed_at, now()) else unsubscribed_at end
    where id = ${id}::uuid`);
  return { ok: true, value: undefined };
}

export async function prospectsCsv(): Promise<string> {
  await requireSuperAdmin();
  const rows = (await db().execute(sql`
    select club_name, contact_name, email, phone, website, town, region, style, organisation, source, venues, status, emails_sent, last_emailed_at
    from mkt_prospects order by lower(club_name), email`)) as unknown as Array<Record<string, unknown>>;
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Club", "Contact", "Email", "Phone", "Website", "Town", "Region", "Style", "Organisation", "Source", "Venues", "Status", "Emails sent", "Last emailed"];
  const keys = ["club_name", "contact_name", "email", "phone", "website", "town", "region", "style", "organisation", "source", "venues", "status", "emails_sent", "last_emailed_at"];
  return [head.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

/* ---------- Campaigns ---------- */

/** A new draft, blank or copied from a template. "trial-sequence" makes all three trial emails, linked in order. */
export async function createCampaign(templateKey?: string): Promise<Result<{ id: string }>> {
  await requireSuperAdmin();
  const insert = async (name: string, c: MarketingContent, follows: string | null, delay: number) => {
    const [r] = (await db().execute(sql`
      insert into mkt_campaigns (name, subject, preheader, heading, body, button_label, button_url, follows_campaign_id, delay_days, daily_limit)
      values (${name}, ${c.subject}, ${c.preheader}, ${c.heading}, ${c.body}, ${c.buttonLabel}, ${c.buttonUrl}, ${follows}::uuid, ${delay}, 50)
      returning id`)) as unknown as Array<{ id: string }>;
    return r.id;
  };
  if (templateKey === "trial-sequence") {
    let prev: string | null = null;
    let first = "";
    for (const t of TRIAL_SEQUENCE) {
      prev = await insert(t.name, t.content, prev, t.delayDays);
      first ||= prev;
    }
    return { ok: true, value: { id: first } };
  }
  const t = templateKey ? templateByKey(templateKey) : null;
  const id = await insert(t?.name ?? "New email", t?.content ?? { subject: "", preheader: "", heading: "", body: "Hi {{first_name}},\n\n", buttonLabel: "Try Junbi free for 7 days", buttonUrl: "https://junbi.co.uk/signup" }, null, 0);
  return { ok: true, value: { id } };
}

export async function getCampaign(id: string) {
  await requireSuperAdmin();
  const c = await campaignRow(id);
  if (!c) return null;
  const [n] = (await db().execute(sql`
    select
      (select count(*)::int from mkt_prospects p where ${reachable(c)}) as remaining,
      (select count(*)::int from mkt_prospects p where ${eligible(c)}) as ready_now,
      (select count(*)::int from mkt_sends where campaign_id = ${c.id}::uuid and status = 'sent') as sent,
      (select count(*)::int from mkt_sends where campaign_id = ${c.id}::uuid and status = 'failed') as failed,
      (select count(*)::int from mkt_sends where campaign_id = ${c.id}::uuid and status in ('sent', 'queued') and sent_at >= ${ukToday}) as today`)) as unknown as Array<{ remaining: number; ready_now: number; sent: number; failed: number; today: number }>;
  const others = (await db().execute(sql`select id, name from mkt_campaigns where id <> ${c.id}::uuid order by created_at desc limit 50`)) as unknown as Array<{ id: string; name: string }>;
  const [sample] = (await db().execute(sql`select contact_name, club_name, town, source from mkt_prospects p where ${reachable(c)} order by random() limit 1`)) as unknown as Array<{ contact_name: string; club_name: string; town: string; source: string }>;
  const recent = (await db().execute(sql`
    select p.email, p.club_name, s.status, s.error, s.sent_at from mkt_sends s join mkt_prospects p on p.id = s.prospect_id
    where s.campaign_id = ${c.id}::uuid order by s.sent_at desc limit 25`)) as unknown as Array<{ email: string; club_name: string; status: string; error: string | null; sent_at: Date }>;
  return {
    campaign: {
      id: c.id, name: c.name, content: contentOf(c), audienceStyle: c.audience_style, audienceSource: c.audience_source, followsId: c.follows_campaign_id,
      delayDays: c.delay_days, dailyLimit: c.daily_limit, status: c.status, testSentAt: c.test_sent_at ? new Date(c.test_sent_at) : null,
      startedAt: c.started_at ? new Date(c.started_at) : null, finishedAt: c.finished_at ? new Date(c.finished_at) : null,
    },
    stats: n,
    others,
    sample: sample ? { firstName: sample.contact_name, clubName: sample.club_name, town: sample.town, source: sample.source } : { firstName: "Sam", clubName: "Riverside Taekwondo", town: "Leeds", source: "british-taekwondo" },
    recent: recent.map((r) => ({ email: r.email, clubName: r.club_name, status: r.status, error: r.error, at: new Date(r.sent_at) })),
  };
}

const campaignSchema = z.object({
  name: text(120).min(1, "Give this email a name (only you see it)."),
  subject: text(150).min(1, "Write a subject line."),
  preheader: text(200),
  heading: text(150),
  body: text(20000).min(1, "Write the email."),
  buttonLabel: text(60),
  buttonUrl: z.union([z.literal(""), z.string().trim().url("Enter the full link, starting https://").max(500).refine((u) => u.startsWith("https://"), "Links must start https://")]),
  audienceStyle: z.enum(["all", "WT", "ITF"]),
  audienceSource: z.union([z.literal(""), z.enum(SOURCE_KEYS)]),
  followsId: z.union([z.literal(""), z.string().uuid()]),
  delayDays: z.coerce.number().int().min(0).max(60),
  dailyLimit: z.coerce.number().int().min(1, "At least 1 a day.").max(2000, "2,000 a day at most."),
});
export type CampaignInput = z.input<typeof campaignSchema>;

/** Saves a draft (or a paused campaign). Changing what the email says means sending yourself a new test first. */
export async function saveCampaign(id: string, raw: CampaignInput): Promise<Result> {
  await requireSuperAdmin();
  const c = await campaignRow(id);
  if (!c) return { ok: false, errors: { form: "That email no longer exists." } };
  if (c.status === "sending" || c.status === "sent") return { ok: false, errors: { form: c.status === "sent" ? "This email has finished sending. Duplicate it to send something similar." : "Pause sending before you change it." } };
  const p = campaignSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: errorsOf(p.error) };
  const d = p.data;
  if (d.buttonLabel && !d.buttonUrl) return { ok: false, errors: { buttonUrl: "Add the link for the button, or clear the button text." } };
  if (d.followsId === id) return { ok: false, errors: { followsId: "An email can't follow itself." } };
  const changed = c.subject !== d.subject || c.preheader !== d.preheader || c.heading !== d.heading || c.body !== d.body || c.button_label !== d.buttonLabel || c.button_url !== d.buttonUrl;
  await db().execute(sql`
    update mkt_campaigns set name = ${d.name}, subject = ${d.subject}, preheader = ${d.preheader}, heading = ${d.heading}, body = ${d.body},
      button_label = ${d.buttonLabel}, button_url = ${d.buttonUrl}, audience_style = ${d.audienceStyle}, audience_source = ${d.audienceSource},
      follows_campaign_id = ${d.followsId || null}::uuid, delay_days = ${d.followsId ? d.delayDays : 0}, daily_limit = ${d.dailyLimit},
      test_sent_at = case when ${changed} then null else test_sent_at end, updated_at = now()
    where id = ${id}::uuid`);
  return { ok: true, value: undefined };
}

export async function duplicateCampaign(id: string): Promise<Result<{ id: string }>> {
  await requireSuperAdmin();
  const c = await campaignRow(id);
  if (!c) return { ok: false, errors: { form: "That email no longer exists." } };
  const [r] = (await db().execute(sql`
    insert into mkt_campaigns (name, subject, preheader, heading, body, button_label, button_url, audience_style, audience_source, daily_limit)
    values (${`${c.name} (copy)`.slice(0, 120)}, ${c.subject}, ${c.preheader}, ${c.heading}, ${c.body}, ${c.button_label}, ${c.button_url}, ${c.audience_style}, ${c.audience_source}, ${c.daily_limit})
    returning id`)) as unknown as Array<{ id: string }>;
  return { ok: true, value: { id: r.id } };
}

/** Drafts that never sent anything can be deleted. */
export async function deleteCampaign(id: string): Promise<Result> {
  await requireSuperAdmin();
  const rows = (await db().execute(sql`
    delete from mkt_campaigns c where c.id = ${id}::uuid and c.status = 'draft'
      and not exists (select 1 from mkt_sends s where s.campaign_id = c.id) returning id`)) as unknown as Array<{ id: string }>;
  return rows.length ? { ok: true, value: undefined } : { ok: false, errors: { form: "Only drafts that haven't sent anything can be deleted." } };
}

async function unsubscribeUrl(prospectId: string) {
  return `${await appUrl()}/marketing/unsubscribe?t=${encodeURIComponent(signLink("mkt-unsub", { pr: prospectId }, UNSUB_TTL))}`;
}

/** Sends the email to the admin, filled in with a real prospect's details, so they can check it in their own inbox. */
export async function sendTestEmail(id: string, to?: string): Promise<Result<{ to: string }>> {
  const admin = await requireSuperAdmin();
  const data = await getCampaign(id);
  if (!data) return { ok: false, errors: { form: "That email no longer exists." } };
  const address = z.string().trim().toLowerCase().email().safeParse(to || admin.email);
  if (!address.success) return { ok: false, errors: { testTo: "Enter a valid email address." } };
  const e = renderMarketingEmail(data.campaign.content, data.sample, { unsubscribeUrl: `${await appUrl()}/marketing/unsubscribe`, reason: reasonFor(data.sample.source) });
  const r = await sendEmail({ to: address.data, subject: `[Test] ${e.subject}`, html: e.html, text: e.text, template: "mkt-test", fromName: FROM_NAME });
  if (r.status === "failed") return { ok: false, errors: { form: `The test didn't send: ${r.error ?? "unknown error"}.` } };
  await db().execute(sql`update mkt_campaigns set test_sent_at = now() where id = ${id}::uuid`);
  return { ok: true, value: { to: address.data } };
}

/** Starts (or resumes) sending. The hourly job does the rest; "Send the next batch now" doesn't wait for it. */
export async function startCampaign(id: string): Promise<Result> {
  await requireSuperAdmin();
  const c = await campaignRow(id);
  if (!c) return { ok: false, errors: { form: "That email no longer exists." } };
  if (c.status === "sent") return { ok: false, errors: { form: "This email has already finished sending." } };
  if (!c.subject.trim() || !c.body.trim()) return { ok: false, errors: { form: "Write the subject and the email first." } };
  if (!c.test_sent_at) return { ok: false, errors: { form: "Send yourself a test of this version first and check it on your phone." } };
  if (!canReallySend()) return { ok: false, errors: { form: "Email sending isn't connected yet. Add RESEND_API_KEY in Netlify first." } };
  const [n] = (await db().execute(sql`select count(*)::int as n from mkt_prospects p where ${reachable(c)}`)) as unknown as Array<{ n: number }>;
  if (!c.follows_campaign_id && !n?.n) return { ok: false, errors: { form: "Nobody on the list matches who this email is for." } };
  await db().execute(sql`update mkt_campaigns set status = 'sending', started_at = coalesce(started_at, now()), updated_at = now() where id = ${id}::uuid`);
  return { ok: true, value: undefined };
}

export async function pauseCampaign(id: string): Promise<Result> {
  await requireSuperAdmin();
  await db().execute(sql`update mkt_campaigns set status = 'paused', updated_at = now() where id = ${id}::uuid and status = 'sending'`);
  return { ok: true, value: undefined };
}

/* ---------- Sending ---------- */

/** Live, never mark people as emailed when there's no email provider to send through. */
const canReallySend = () => emailConfigured() || process.env.NODE_ENV !== "production";

/** Weekdays 9am to 5pm UK time. Emails to club owners land better in working hours than at 3am. */
export function inSendingWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return !["Sat", "Sun"].includes(day) && hour >= 9 && hour < 17;
}

/**
 * Sends the next few emails for one campaign. The batch is claimed in the database first (a "queued" row per person),
 * so two runs at once can never email the same person twice.
 */
async function sendBatchFor(c: CampaignRow, max: number) {
  if (!canReallySend()) return { sent: 0, failed: 0 };
  const [{ today }] = (await db().execute(sql`
    select count(*)::int as today from mkt_sends where campaign_id = ${c.id}::uuid and status in ('sent', 'queued') and sent_at >= ${ukToday}`)) as unknown as Array<{ today: number }>;
  const allowance = Math.max(0, Math.min(max, c.daily_limit - today));
  if (allowance === 0) return { sent: 0, failed: 0 };
  const claimed = (await db().execute(sql`
    insert into mkt_sends (campaign_id, prospect_id, status)
    select ${c.id}::uuid, p.id, 'queued' from mkt_prospects p where ${eligible(c)} order by p.created_at, p.id limit ${allowance}
    on conflict do nothing
    returning prospect_id`)) as unknown as Array<{ prospect_id: string }>;
  if (!claimed.length) {
    // Nothing left. A first email is finished; a follow-up is finished once the email it follows has finished
    // and everyone it reached has had their turn.
    const [left] = (await db().execute(sql`select count(*)::int as n from mkt_prospects p where ${reachable(c)}`)) as unknown as Array<{ n: number }>;
    const parentDone = !c.follows_campaign_id || ((await db().execute(sql`select 1 from mkt_campaigns where id = ${c.follows_campaign_id}::uuid and status = 'sent'`)) as unknown as unknown[]).length > 0;
    if (!left?.n && parentDone) await db().execute(sql`update mkt_campaigns set status = 'sent', finished_at = now(), updated_at = now() where id = ${c.id}::uuid and status = 'sending'`);
    return { sent: 0, failed: 0 };
  }
  const people = (await db().execute(sql`
    select id, email, contact_name, club_name, town, source from mkt_prospects where id in (select (jsonb_array_elements_text(${JSON.stringify(claimed.map((r) => r.prospect_id))}::jsonb))::uuid)`)) as unknown as Array<{
    id: string; email: string; contact_name: string; club_name: string; town: string; source: string;
  }>;
  const base = await appUrl();
  const emails: BatchEmail[] = [];
  for (const p of people) {
    const unsub = await unsubscribeUrl(p.id);
    const e = renderMarketingEmail(contentOf(c), { firstName: p.contact_name, clubName: p.club_name, town: p.town }, { unsubscribeUrl: unsub, reason: reasonFor(p.source) });
    const oneClick = `${base}/api/marketing/unsubscribe?t=${encodeURIComponent(signLink("mkt-unsub", { pr: p.id }, UNSUB_TTL))}`;
    emails.push({
      to: p.email, subject: e.subject, html: e.html, text: e.text, fromName: FROM_NAME,
      headers: { "List-Unsubscribe": `<${oneClick}>, <mailto:hello@junbi.co.uk?subject=Unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
  }
  const results = await sendBatch(emails);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < people.length; i++) {
    const r = results[i];
    const ok = r?.status === "sent" || r?.status === "logged";
    if (ok) sent++;
    else failed++;
    await db().execute(sql`
      update mkt_sends set status = ${ok ? "sent" : "failed"}, provider_id = ${r?.providerId ?? null}, error = ${ok ? null : (r?.error ?? "Unknown error").slice(0, 500)}, sent_at = now()
      where campaign_id = ${c.id}::uuid and prospect_id = ${people[i].id}::uuid`);
    if (ok) await db().execute(sql`update mkt_prospects set emails_sent = emails_sent + 1, last_emailed_at = now() where id = ${people[i].id}::uuid`);
  }
  return { sent, failed };
}

/** "Send the next batch now" on the campaign page: up to 100, still within today's limit, any time of day. */
export async function sendNextBatchNow(id: string): Promise<Result<{ sent: number; failed: number }>> {
  await requireSuperAdmin();
  const c = await campaignRow(id);
  if (!c || c.status !== "sending") return { ok: false, errors: { form: "Start sending first." } };
  return { ok: true, value: await sendBatchFor(c, 100) };
}

/**
 * The hourly job. In working hours, each sending campaign sends about an eighth of its daily limit, so 100 a day
 * goes out as roughly 13 an hour between 9am and 5pm rather than all at once.
 */
export async function runMarketingSends(now = new Date()) {
  if (!inSendingWindow(now)) return { skipped: "outside sending hours", sent: 0, failed: 0 };
  const live = (await db().execute(sql`select * from mkt_campaigns where status = 'sending' order by started_at`)) as unknown as CampaignRow[];
  let sent = 0;
  let failed = 0;
  for (const c of live) {
    const r = await sendBatchFor(c, Math.ceil(c.daily_limit / 8));
    sent += r.sent;
    failed += r.failed;
  }
  return { campaigns: live.length, sent, failed };
}

/* ---------- Unsubscribing ---------- */

/** From the link in the footer (a button press) or the one-click header (a POST from the mail app). */
export async function marketingUnsubscribe(token: unknown): Promise<boolean> {
  const v = verifyLink<{ pr: string }>("mkt-unsub", token);
  if (!v || !z.string().uuid().safeParse(v.pr).success) return false;
  const rows = (await db().execute(sql`
    update mkt_prospects set status = 'unsubscribed', unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now()
    where id = ${v.pr}::uuid returning email`)) as unknown as Array<{ email: string }>;
  if (!rows.length) return false;
  // Same person in the Library CRM: stop those emails too.
  await db().execute(sql`update crm_contacts set marketing_ok = false, unsubscribed_at = coalesce(unsubscribed_at, now()), followup_due_at = null where email = ${rows[0].email}`);
  return true;
}
