import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { libraryEmail, sendEmail } from "@/lib/email";
import type { Result } from "./accounts";

/* ---------- Junbi Competitions: "tell me when it's live" ---------- */

export const COMPETITION_INTERESTS = ["host", "enter", "both"] as const;
export type CompetitionInterest = (typeof COMPETITION_INTERESTS)[number];

const INTEREST_LABEL: Record<CompetitionInterest, string> = {
  host: "hosting competitions",
  enter: "entering competitions",
  both: "hosting and entering competitions",
};

export const competitionInterestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  clubName: z.string().trim().max(120).optional().default(""),
  interest: z.enum(COMPETITION_INTERESTS, { errorMap: () => ({ message: "Choose how you'd use it." }) }),
  marketingOk: z.boolean(),
});
export type CompetitionInterestInput = z.input<typeof competitionInterestSchema>;

/**
 * Records someone who wants to hear when Junbi Competitions launches as a CRM contact
 * (due a follow-up today) and sends them a short confirmation email.
 */
export async function registerCompetitionInterest(raw: CompetitionInterestInput): Promise<Result<null>> {
  const p = competitionInterestSchema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  // A contact who came from somewhere else keeps that source; the interest is logged as an event either way.
  const [c] = (await db().execute(sql`
    insert into crm_contacts (email, name, source, marketing_ok, next_action_on)
    values (${d.email}, ${d.name}, 'competitions', ${d.marketingOk}, current_date)
    on conflict (email) do update set
      name = excluded.name,
      marketing_ok = crm_contacts.marketing_ok or excluded.marketing_ok,
      unsubscribed_at = case when excluded.marketing_ok then null else crm_contacts.unsubscribed_at end,
      stage = case when crm_contacts.stage = 'not_interested' then 'new' else crm_contacts.stage end,
      next_action_on = coalesce(least(crm_contacts.next_action_on, current_date), current_date),
      updated_at = now(), last_activity_at = now()
    returning id`)) as unknown as Array<{ id: string }>;
  const club = d.clubName ? ` for ${d.clubName}` : "";
  await db().execute(sql`insert into crm_events (contact_id, kind, detail) values (${c.id}::uuid, 'note', ${`Wants to hear when Junbi Competitions launches: ${INTEREST_LABEL[d.interest]}${club}${d.marketingOk ? ", said yes to emails" : ""}`})`);

  const t = libraryEmail(
    "You're on the Junbi Competitions list",
    "We'll tell you when it's live.",
    [
      `Hi ${d.name.split(/\s+/)[0]},`,
      "Thanks for your interest in Junbi Competitions. It will run poomsae and WT sparring: clubs enter in minutes with every athlete placed in the right category, and hosts get live entries, waiting lists and lists for the scoring table.",
      "We'll email you as soon as it opens. If you're planning a competition in the meantime, reply to this email and tell us about it.",
    ],
    undefined,
    undefined,
    "You're getting this because you asked to hear when Junbi Competitions launches.",
  );
  await sendEmail({ to: d.email, subject: t.subject, html: t.html, text: t.text, template: "competitions-interest" }).catch((err) => console.error("competitions interest email failed", err));
  return { ok: true, value: null };
}
