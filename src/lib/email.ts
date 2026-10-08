import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";

/*
 * Sends email through Resend (https://resend.com) using its HTTP API, so there is no SDK to keep updated.
 * Needs RESEND_API_KEY and EMAIL_FROM (for example "Junbi <hello@junbi.co.uk>") in the environment.
 * Without a key, emails are written to the server log instead of sent, so local development and tests work.
 * Every send is recorded in email_log; a dedupe key stops the same reminder going out twice.
 */

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  clubId?: string | null;
  dedupeKey?: string;
  replyTo?: string;
};

export type SendResult = { status: "sent" | "logged" | "skipped" | "failed"; error?: string };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(e: Email): Promise<SendResult> {
  if (e.dedupeKey) {
    const [row] = (await db().execute(sql`select email_already_sent(${e.dedupeKey}) as sent`)) as unknown as Array<{ sent: boolean }>;
    if (row?.sent) return { status: "skipped" };
  }

  let result: SendResult;
  let providerId: string | null = null;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email not sent: RESEND_API_KEY not set] to=${e.to} subject="${e.subject}"\n${e.text}`);
    result = { status: "logged" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Junbi <hello@junbi.co.uk>",
          to: [e.to],
          subject: e.subject,
          html: e.html,
          text: e.text,
          ...(e.replyTo ? { reply_to: e.replyTo } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) {
        providerId = body.id ?? null;
        result = { status: "sent" };
      } else {
        result = { status: "failed", error: body.message ?? `HTTP ${res.status}` };
      }
    } catch (err) {
      result = { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  // "logged" counts as sent for dedupe purposes only when there's no provider, so dev reminders don't repeat.
  const logStatus = result.status === "logged" ? "sent" : result.status;
  await db().execute(
    sql`select email_log_write(${e.clubId ?? null}::uuid, ${e.to}, ${e.template}, ${e.dedupeKey ?? null}, ${logStatus}, ${providerId}, ${result.error ?? null})`,
  );
  if (result.status === "failed") console.error(`Email "${e.template}" to ${e.to} failed: ${result.error}`);
  return result;
}

/** The site's own address, for links in emails. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {
    // Not in a request (e.g. a scheduled job).
  }
  return process.env.URL ?? "http://localhost:3000";
}

/* ---------- Templates ---------- */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  const ps = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1d1d1f">${esc(p)}</p>`).join("");
  const btn = button
    ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#0066cc;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 24px;border-radius:980px">${esc(button.label)}</a></p>`
    : "";
  const foot = footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6e6e73">${esc(footnote)}</p>` : "";
  return `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:36px 32px">
<tr><td>
<p style="margin:0 0 28px;font-size:22px;font-weight:600;letter-spacing:-0.025em;color:#1d1d1f">junbi</p>
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f">${esc(title)}</h1>
${ps}${btn}${foot}
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;color:#86868b">Junbi · Simple club management for martial arts</p>
</td></tr></table></body></html>`;
}

function plain(title: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  return [title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), ...(footnote ? ["", footnote] : []), "", "Junbi"].join("\n");
}

function build(subject: string, title: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  return { subject, html: layout(title, paragraphs, button, footnote), text: plain(title, paragraphs, button, footnote) };
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export const templates = {
  welcome: (name: string, clubName: string, url: string) =>
    build(
      `Welcome to Junbi, ${first(name)}`,
      `${clubName} is ready.`,
      [
        `Hi ${first(name)},`,
        "Thanks for choosing Junbi. Your free trial has started and every feature is switched on.",
        "The quickest way to get going: add a few students, set up your weekly classes, then take your first register on your phone.",
      ],
      { label: "Open Junbi", url: `${url}/today` },
      "Any questions, just reply to this email.",
    ),
  passwordReset: (name: string, url: string) =>
    build(
      "Reset your Junbi password",
      "Reset your password.",
      [`Hi ${first(name)},`, "Someone asked to reset the password for your Junbi account. If that was you, use the button below. The link works for one hour."],
      { label: "Choose a new password", url },
      "If you didn't ask for this, you can ignore this email. Your password won't change.",
    ),
  staffInvite: (clubName: string, inviterName: string | null, role: string, url: string) =>
    build(
      `Join ${clubName} on Junbi`,
      `You're invited to ${clubName}.`,
      [
        `${inviterName ? `${inviterName} has` : "You've been"} invited you to join ${clubName} on Junbi as ${role === "admin" ? "an admin" : role === "instructor" ? "an instructor" : "an assistant"}.`,
        "Junbi is where the club keeps its students, classes and registers.",
      ],
      { label: "Accept invitation", url },
      "This invitation lasts for 7 days.",
    ),
  trialReminder: (name: string, clubName: string, daysLeft: number, endsOn: string, url: string) =>
    build(
      daysLeft === 1 ? "Your Junbi trial ends tomorrow" : `${daysLeft} days left in your Junbi trial`,
      daysLeft === 1 ? "Your trial ends tomorrow." : `${daysLeft} days left in your trial.`,
      [
        `Hi ${first(name)},`,
        `Your free trial for ${clubName} ends on ${new Date(`${endsOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
        daysLeft === 7
          ? "Still moving your club across? You can add another 14 days, once, from Settings."
          : "Nothing you've added will be lost. Reply to this email if you'd like a hand getting set up.",
      ],
      { label: "Open Junbi", url: `${url}/settings` },
    ),
};
