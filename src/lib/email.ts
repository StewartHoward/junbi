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
  /** Show the email as from this name (e.g. the club) instead of Junbi. The address stays the same. */
  fromName?: string;
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
          from: fromWithName(e.fromName),
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

export type BatchEmail = { to: string; subject: string; html: string; text: string; fromName?: string; replyTo?: string };
export type BatchResult = { status: "sent" | "logged" | "failed"; providerId?: string; error?: string };

/** "Junbi <hello@junbi.co.uk>" with a different display name, e.g. the club's. */
function fromWithName(name?: string) {
  const from = process.env.EMAIL_FROM || "Junbi <hello@junbi.co.uk>";
  if (!name) return from;
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const clean = name.replace(/["<>\r\n]/g, "").trim().slice(0, 80) || "Junbi";
  return `"${clean}" <${address}>`;
}

/**
 * Sends many emails through Resend's batch endpoint, 100 per request. Results come back in the same order.
 * Without RESEND_API_KEY each email is written to the log instead.
 */
export async function sendBatch(emails: BatchEmail[]): Promise<BatchResult[]> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    for (const e of emails) console.log(`[email not sent: RESEND_API_KEY not set] to=${e.to} subject="${e.subject}"`);
    return emails.map(() => ({ status: "logged" as const }));
  }
  const out: BatchResult[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          chunk.map((e) => ({
            from: fromWithName(e.fromName),
            to: [e.to],
            subject: e.subject,
            html: e.html,
            text: e.text,
            ...(e.replyTo ? { reply_to: e.replyTo } : {}),
          })),
        ),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: Array<{ id: string }>; message?: string };
      if (res.ok && Array.isArray(body.data)) {
        chunk.forEach((_, j) => out.push(body.data![j] ? { status: "sent", providerId: body.data![j].id } : { status: "failed", error: "No id returned" }));
      } else {
        const error = body.message ?? `HTTP ${res.status}`;
        console.error(`Batch email failed: ${error}`);
        chunk.forEach(() => out.push({ status: "failed", error }));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      chunk.forEach(() => out.push({ status: "failed", error }));
    }
    // Resend allows a couple of requests a second.
    if (i + 100 < emails.length) await new Promise((r) => setTimeout(r, 600));
  }
  return out;
}

/** The site's own address, for links in emails. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Live, never build links from request headers: a forged Host header could point reset links at another site.
  // Netlify sets URL to the site's main address.
  if (process.env.NODE_ENV === "production" && process.env.URL) return process.env.URL.replace(/\/$/, "");
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

/** Like layout(), but the club's name leads and line breaks inside a paragraph are kept. */
function clubLayout(clubName: string, title: string, paragraphs: string[], footnote: string, button?: { label: string; url: string }) {
  const ps =
    paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1d1d1f">${esc(p).replace(/\n/g, "<br>")}</p>`).join("") +
    (button
      ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#0066cc;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 24px;border-radius:980px">${esc(button.label)}</a></p>`
      : "");
  return `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:36px 32px">
<tr><td>
<p style="margin:0 0 24px;font-size:15px;font-weight:600;color:#6e6e73">${esc(clubName)}</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f">${esc(title)}</h1>
${ps}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6e6e73">${esc(footnote)}</p>
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;color:#86868b">Sent with Junbi</p>
</td></tr></table></body></html>`;
}

function plain(title: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  return [title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), ...(footnote ? ["", footnote] : []), "", "Junbi"].join("\n");
}

function build(subject: string, title: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  return { subject, html: layout(title, paragraphs, button, footnote), text: plain(title, paragraphs, button, footnote) };
}

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export type LeadEmail = {
  firstName: string;
  studentName: string | null;
  clubName: string;
  session: { when: Date; className: string | null; siteName: string | null; address: string | null } | null;
  signupUrl: string | null;
};

const WHAT_TO_BRING = "Please wear comfortable clothes like a T-shirt and joggers, bring a bottle of water, and arrive about 10 minutes early so we can say hello.";

function sessionLines(l: LeadEmail) {
  const s = l.session!;
  const day = s.when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
  const time = s.when.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" }).replace(" ", "");
  return [`${day} at ${time}`, s.className, [s.siteName, s.address].filter(Boolean).join(", ") || null].filter(Boolean).join("\n");
}

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
  joinInvite: (clubName: string, inviterName: string | null, url: string) =>
    build(
      `Sign up to ${clubName}`,
      `Join ${clubName}.`,
      [
        `${inviterName ? `${inviterName} from ${clubName}` : clubName} has sent you a link to sign up.`,
        "It takes about two minutes: your details, who's training, and any medical notes the instructors should know about.",
      ],
      { label: "Sign up", url },
      "If you weren't expecting this, you can ignore it.",
    ),
  paymentLink: (parentName: string, clubName: string, studentName: string, planText: string, providerName: string, url: string) =>
    build(
      `Set up your Direct Debit for ${clubName}`,
      "Set up your Direct Debit.",
      [
        `Hi ${first(parentName)},`,
        `${clubName} has added ${studentName} to ${planText}. Please set up the Direct Debit with ${providerName}. It takes about two minutes and is protected by the Direct Debit Guarantee.`,
        "The link works for 24 hours. If it runs out, just ask the club for a new one.",
      ],
      { label: "Set up Direct Debit", url },
      "If you weren't expecting this, contact the club before setting anything up.",
    ),
  joinConfirm: (parentName: string, clubName: string, names: string[], awaitingDebit = false) =>
    build(
      `You're signed up to ${clubName}`,
      "Thanks, you're signed up.",
      [
        `Hi ${first(parentName)},`,
        awaitingDebit
          ? `We've got ${list(names)}'s details. Your place at ${clubName} is confirmed once your Direct Debit is set up. If you didn't finish it, the club can send you a link.`
          : `${list(names)} ${names.length === 1 ? "is" : "are"} now registered with ${clubName}. The club will be in touch about classes.`,
        "If anything changes, like medical details or contact numbers, just let the club know.",
      ],
    ),
  newSignup: (clubName: string, parentName: string, names: string[], url: string, awaitingDebit = false) =>
    build(
      `New sign-up: ${list(names)}`,
      `New sign-up for ${clubName}.`,
      [
        `${parentName} has signed up ${list(names)} using your sign-up link.`,
        awaitingDebit
          ? "They become members once their Direct Debit is set up. Until then they show as Sign-up unfinished, and you can send them a payment link from their profile."
          : "They're on your student list as members.",
      ],
      { label: "See them in Junbi", url },
    ),
  /** Sent from a student's profile: the family picks a membership and sets up Direct Debit. */
  choosePlanLink: (parentName: string, clubName: string, names: string[], url: string) =>
    build(
      `Finish joining ${clubName}`,
      "Choose a membership and set up your Direct Debit.",
      [
        `Hi ${first(parentName)},`,
        `To finish ${list(names)}'s place at ${clubName}, please choose a membership and set up your Direct Debit. It takes about two minutes and is protected by the Direct Debit Guarantee.`,
        "The link works for 14 days. If it runs out, just ask the club for a new one.",
      ],
      { label: "Choose a membership", url },
      "If you weren't expecting this, contact the club before setting anything up.",
    ),
  /** A message from a club to its families. Body paragraphs are split on blank lines. */
  clubMessage: (clubName: string, senderName: string | null, subject: string, body: string) => {
    const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const title = subject;
    const foot = `Sent by ${senderName ? `${senderName} at ` : ""}${clubName}. Reply to this email to get in touch with the club.`;
    return { subject: `${subject}`, html: clubLayout(clubName, title, paragraphs, foot), text: [clubName, "", title, "", ...paragraphs, "", foot].join("\n") };
  },
  /** First email to a new lead: thanks, their trial session if booked, and the club's details. */
  leadWelcome: (l: LeadEmail) => {
    const who = l.studentName ? `${l.studentName}'s` : "your";
    const paragraphs = [
      `Hi ${first(l.firstName)},`,
      `Thanks for getting in touch with ${l.clubName}. We'd love to see ${l.studentName ? l.studentName : "you"} on the mat.`,
      ...(l.session ? [`${l.studentName ? `${l.studentName}'s` : "Your"} free trial session is booked:\n${sessionLines(l)}`, WHAT_TO_BRING] : ["We'll be in touch shortly to book " + who + " free trial session."]),
      ...(l.signupUrl ? ["When you're ready to join, you can sign up online here. It takes about two minutes."] : []),
    ];
    const foot = `Sent by ${l.clubName}. Reply to this email with any questions.`;
    const button = l.signupUrl ? { label: "Sign up", url: l.signupUrl } : undefined;
    const subject = l.session ? `Your free trial at ${l.clubName}` : `Thanks for your interest in ${l.clubName}`;
    const title = l.session ? "Your free trial is booked." : "Thanks for getting in touch.";
    return { subject, html: clubLayout(l.clubName, title, paragraphs, foot, button), text: [l.clubName, "", title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), "", foot].join("\n") };
  },
  /** The day before their trial session. */
  leadReminder: (l: LeadEmail) => {
    const paragraphs = [
      `Hi ${first(l.firstName)},`,
      `Just a reminder that ${l.studentName ? `${l.studentName}'s` : "your"} free trial session at ${l.clubName} is coming up:\n${sessionLines(l)}`,
      WHAT_TO_BRING,
      "If you can't make it, just reply to this email and we'll find another time.",
    ];
    const foot = `Sent by ${l.clubName}. Reply to this email with any questions.`;
    const button = l.signupUrl ? { label: "Sign up", url: l.signupUrl } : undefined;
    const title = "See you soon.";
    return { subject: `Reminder: your free trial at ${l.clubName}`, html: clubLayout(l.clubName, title, paragraphs, foot, button), text: [l.clubName, "", title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), "", foot].join("\n") };
  },
  trialReminder: (name: string, clubName: string, daysLeft: number, endsOn: string, url: string) =>
    build(
      daysLeft === 1 ? "Your Junbi trial ends tomorrow" : `${daysLeft} days left in your Junbi trial`,
      daysLeft === 1 ? "Your trial ends tomorrow." : `${daysLeft} days left in your trial.`,
      [
        `Hi ${first(name)},`,
        `Your free trial for ${clubName} ends on ${new Date(`${endsOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
        "Nothing you've added will be lost. Reply to this email if you'd like a hand getting set up.",
      ],
      { label: "Open Junbi", url: `${url}/settings` },
    ),
};
