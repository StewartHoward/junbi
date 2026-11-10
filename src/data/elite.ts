import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { appUrl, libraryEmail, sendEmail } from "@/lib/email";
import { ARTS, SIZES, SYSTEMS } from "@/lib/ebooks";
import type { Result } from "./accounts";

/** Junbi Elite is sold by enquiry only. An enquiry lands in the CRM (due for a call today) and is emailed to Junbi. */

export const SITE_COUNTS = ["One", "Two", "Three or more", "Opening a new one"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z.string().trim().max(40).refine((v) => v === "" || /^[+\d][\d\s()-]{6,}$/.test(v), "Enter a valid phone number, or leave it blank."),
  clubName: z.string().trim().min(1, "Enter your club's name.").max(120),
  currentSite: z.string().trim().max(200),
  arts: z.array(z.enum(ARTS)).max(ARTS.length),
  size: z.enum(SIZES, { message: "Choose how many students you have." }),
  sites: z.enum(SITE_COUNTS, { message: "Choose how many locations you have." }),
  system: z.enum(SYSTEMS, { message: "Choose what you use now." }),
  message: z.string().trim().max(4000),
});
export type EliteInput = z.input<typeof schema>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEliteEnquiry(raw: EliteInput): Promise<Result> {
  const p = schema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  const summary = [
    `Club: ${d.clubName}`,
    `Students: ${d.size}`,
    `Locations: ${d.sites}`,
    `Uses now: ${d.system}`,
    ...(d.arts.length ? [`Style: ${d.arts.join(", ")}`] : []),
    ...(d.currentSite ? [`Website now: ${d.currentSite}`] : []),
    ...(d.phone ? [`Phone: ${d.phone}`] : []),
    ...(d.message ? ["", d.message] : []),
  ];

  // The CRM record comes first: it's the thing that must not be lost.
  const [c] = (await db().execute(sql`
    insert into crm_contacts (email, name, club_name, phone, arts, size_band, current_system, source, next_action_on)
    values (${d.email}, ${d.name}, ${d.clubName}, ${d.phone}, array(select jsonb_array_elements_text(${JSON.stringify(d.arts)}::jsonb))::text[],
      ${d.size}, ${d.system}, 'elite', current_date)
    on conflict (email) do update set
      name = excluded.name, club_name = excluded.club_name,
      phone = coalesce(nullif(excluded.phone, ''), crm_contacts.phone),
      arts = case when cardinality(excluded.arts) > 0 then excluded.arts else crm_contacts.arts end,
      size_band = excluded.size_band, current_system = excluded.current_system, source = 'elite',
      stage = case when crm_contacts.stage in ('new', 'not_interested') then 'new' else crm_contacts.stage end,
      next_action_on = current_date, updated_at = now(), last_activity_at = now()
    returning id`)) as unknown as Array<{ id: string }>;
  await db().execute(sql`insert into crm_events (contact_id, kind, detail) values (${c.id}::uuid, 'note', ${`Elite enquiry\n${summary.join("\n")}`})`);

  const to = process.env.SUPPORT_EMAIL || "hello@junbi.co.uk";
  const lines = [`From: ${d.name} <${d.email}>`, ...summary];
  await sendEmail({
    to,
    subject: `Elite enquiry: ${d.clubName}`,
    html: `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f">${lines.map((l) => (l ? `<p style="margin:0 0 8px">${esc(l)}</p>` : "<br>")).join("")}<p style="color:#6e6e73;font-size:13px">They're in Leads, due a call today. Reply to this email to answer them.</p></div>`,
    text: `${lines.join("\n")}\n\nThey're in Leads, due a call today.`,
    template: "elite-enquiry",
    replyTo: d.email,
  }).catch((err) => console.error("elite enquiry email failed", err));

  const t = libraryEmail(
    "Your Junbi Elite enquiry",
    "Thanks, we've got your enquiry.",
    [`Hi ${d.name.split(/\s+/)[0]},`, `Thanks for your interest in Junbi Elite for ${d.clubName}.`, "We'll be in touch within one working day to book a short call. We'll ask about your club, show you how Elite works and talk through what we'd build for you.", "If anything comes to mind before then, just reply to this email."],
    undefined,
    undefined,
    "You're getting this because you enquired about Junbi Elite.",
  );
  await sendEmail({ to: d.email, subject: t.subject, html: t.html, text: t.text, template: "elite-thanks" }).catch(() => {});
  return { ok: true, value: undefined };
}

/* ---------- Elite brochure: name and email in, PDF out ---------- */

export const ELITE_BROCHURE_PATH = "/downloads/junbi-elite-brochure.pdf";

const brochureSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  marketingOk: z.boolean(),
});
export type BrochureInput = z.input<typeof brochureSchema>;

/** Records the download in the CRM (due a follow-up today) and emails the brochure link. Returns the download path. */
export async function sendEliteBrochure(raw: BrochureInput): Promise<Result<{ url: string }>> {
  const p = brochureSchema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  // An Elite enquiry keeps its source; anyone else becomes an Elite brochure lead.
  const [c] = (await db().execute(sql`
    insert into crm_contacts (email, name, source, marketing_ok, next_action_on)
    values (${d.email}, ${d.name}, 'elite_brochure', ${d.marketingOk}, current_date)
    on conflict (email) do update set
      name = excluded.name,
      source = case when crm_contacts.source = 'elite' then crm_contacts.source else 'elite_brochure' end,
      marketing_ok = crm_contacts.marketing_ok or excluded.marketing_ok,
      unsubscribed_at = case when excluded.marketing_ok then null else crm_contacts.unsubscribed_at end,
      stage = case when crm_contacts.stage = 'not_interested' then 'new' else crm_contacts.stage end,
      next_action_on = coalesce(least(crm_contacts.next_action_on, current_date), current_date),
      updated_at = now(), last_activity_at = now()
    returning id`)) as unknown as Array<{ id: string }>;
  await db().execute(sql`insert into crm_events (contact_id, kind, detail) values (${c.id}::uuid, 'download', ${`Downloaded the Elite brochure${d.marketingOk ? ", said yes to emails" : ""}`})`);

  const base = await appUrl();
  const t = libraryEmail(
    "Your Junbi Elite brochure",
    "Here's your brochure.",
    [`Hi ${d.name.split(/\s+/)[0]},`, "Thanks for your interest in Junbi Elite. Your brochure is below: what's included, how we build it and what it costs.", "When you're ready to talk about your club, reply to this email or enquire at junbi.co.uk/elite and we'll book a short call."],
    { label: "Download the brochure", url: `${base}${ELITE_BROCHURE_PATH}` },
    undefined,
    "You're getting this because you asked for the Junbi Elite brochure.",
  );
  await sendEmail({ to: d.email, subject: t.subject, html: t.html, text: t.text, template: "elite-brochure" }).catch((err) => console.error("elite brochure email failed", err));
  return { ok: true, value: { url: ELITE_BROCHURE_PATH } };
}
