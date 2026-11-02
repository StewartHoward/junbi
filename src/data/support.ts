import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { libraryEmail, sendEmail } from "@/lib/email";
import type { Result } from "./accounts";

/** A message from the support button: emailed to Junbi, and the sender is added to (or noted in) the CRM. */
const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  message: z.string().trim().min(5, "Tell us a little more.").max(4000),
  page: z.string().trim().max(300),
  club: z.string().trim().max(120),
});

export async function sendSupportMessage(raw: z.input<typeof schema>): Promise<Result> {
  const p = schema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  const to = process.env.SUPPORT_EMAIL || "hello@junbi.co.uk";
  const lines = [`From: ${d.name} <${d.email}>`, ...(d.club ? [`Club: ${d.club}`] : []), ...(d.page ? [`Page: ${d.page}`] : []), "", ...d.message.split(/\n+/)];
  const r = await sendEmail({
    to,
    subject: `Support: ${d.name}${d.club ? ` (${d.club})` : ""}`,
    html: `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f">${lines.map((l) => (l ? `<p style="margin:0 0 8px">${l.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)}</p>` : "<br>")).join("")}<p style="color:#6e6e73;font-size:13px">Reply to this email to answer them.</p></div>`,
    text: `${lines.join("\n")}\n\nReply to this email to answer them.`,
    template: "support-message",
    replyTo: d.email,
  });
  if (r.status === "failed") return { ok: false, errors: { form: "Sorry, that didn't send. Please email hello@junbi.co.uk instead." } };

  // Thank-you to the sender, so they know it arrived.
  const t = libraryEmail("We've got your message", "Thanks, we've got your message.", [`Hi ${d.name.split(/\s+/)[0]},`, "A real person will reply to this email address, usually within one working day.", "What you sent:", d.message.slice(0, 1000)], undefined, undefined, "You're getting this because you contacted Junbi support.");
  await sendEmail({ to: d.email, subject: t.subject, html: t.html, text: t.text, template: "support-thanks" }).catch(() => {});

  // Keep a record in the CRM (best effort: the email is what matters).
  try {
    const [c] = (await db().execute(sql`
      insert into crm_contacts (email, name, club_name, source) values (${d.email}, ${d.name}, ${d.club}, 'support')
      on conflict (email) do update set name = coalesce(nullif(crm_contacts.name, ''), excluded.name),
        club_name = coalesce(nullif(crm_contacts.club_name, ''), excluded.club_name), updated_at = now(), last_activity_at = now()
      returning id`)) as unknown as Array<{ id: string }>;
    await db().execute(sql`insert into crm_events (contact_id, kind, detail) values (${c.id}::uuid, 'note', ${`Support message${d.page ? ` from ${d.page}` : ""}:\n${d.message}`})`);
  } catch (err) {
    console.error("support crm note failed", err);
  }
  return { ok: true, value: undefined };
}
