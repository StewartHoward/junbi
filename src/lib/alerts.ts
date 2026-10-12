import "server-only";
import { createHash } from "node:crypto";
import { sendEmail } from "./email";
import { planName } from "./plans";

/*
 * Emails to the Junbi team (ALERT_EMAIL, or hello@junbi.co.uk): something broke, or a club joined.
 * Errors are grouped: the same error sends at most one email every 30 minutes.
 */

const to = () => process.env.ALERT_EMAIL || "hello@junbi.co.uk";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function page(title: string, rows: Array<[string, string]>, note?: string) {
  const text = [title, "", ...rows.map(([k, v]) => `${k}: ${v}`), ...(note ? ["", note] : [])].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1d1d1f;max-width:560px">
<h2 style="font-size:20px;margin:0 0 12px">${esc(title)}</h2>
<table style="border-collapse:collapse;font-size:15px">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6e6e73;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join("")}</table>
${note ? `<p style="margin-top:16px;color:#6e6e73;font-size:13px">${esc(note)}</p>` : ""}</div>`;
  return { text, html };
}

const when = () => new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

/** A new club has signed up. */
export async function alertNewClub(c: { clubName: string; ownerName: string; email: string; plan: string; founding: boolean; promoCode?: string | null }) {
  const body = page(`New club: ${c.clubName}`, [
    ["Club", c.clubName],
    ["Owner", `${c.ownerName} (${c.email})`],
    ["Plan", `${planName(c.plan)}${c.founding ? ", Founding Club" : ""}`],
    ...(c.promoCode ? ([["Code", c.promoCode]] as Array<[string, string]>) : []),
    ["When", when()],
  ], "They'll be asked for a card next. You'll get another email when they add it.");
  await sendEmail({ to: to(), subject: `New club on Junbi: ${c.clubName}`, ...body, template: "alert-new-club" }).catch((e) => console.error("new club alert failed", e));
}

/** A club has added its card for Junbi. */
export async function alertCardAdded(c: { clubId: string; clubName: string; plan: string; status: string }) {
  const body = page(`${c.clubName} added a card`, [
    ["Club", c.clubName],
    ["Plan", planName(c.plan)],
    ["Status", c.status === "trialing" ? "On free trial, first payment when it ends" : c.status],
    ["When", when()],
  ]);
  await sendEmail({ to: to(), subject: `Card added: ${c.clubName}`, ...body, template: "alert-card-added", clubId: c.clubId, dedupeKey: `alert-card:${c.clubId}` }).catch((e) =>
    console.error("card alert failed", e),
  );
}

/** Something went wrong. Never throws, and the same error only emails once every 30 minutes. */
export async function alertError(where: string, err: unknown, extra: Record<string, string | undefined> = {}) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const message = e.message || String(err);
    // Next.js uses thrown errors for redirects and 404s; those aren't problems.
    if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR/.test(message) || (e as { digest?: string }).digest?.startsWith("NEXT_")) return;
    const group = createHash("sha256").update(`${where}|${message}`).digest("hex").slice(0, 16);
    const bucket = Math.floor(Date.now() / (30 * 60_000));
    const rows: Array<[string, string]> = [
      ["Where", where],
      ["Error", message.slice(0, 500)],
      ...Object.entries(extra).filter((x): x is [string, string] => Boolean(x[1])).map(([k, v]) => [k, v.slice(0, 300)] as [string, string]),
      ["When", when()],
      ["Site", process.env.URL ?? "local"],
      ["Details", (e.stack ?? "").split("\n").slice(0, 8).join("\n")],
    ];
    const body = page(`Junbi error: ${where}`, rows, "Repeats of this error are grouped, so you'll get at most one email about it every 30 minutes.");
    await sendEmail({ to: to(), subject: `Junbi error: ${message.slice(0, 80)}`, ...body, template: "alert-error", dedupeKey: `alert:${group}:${bucket}` });
  } catch (sendErr) {
    console.error("error alert failed", sendErr);
  }
}

/** A club's payment to Junbi failed. */
export async function alertClubPaymentFailed(c: { clubId: string; clubName: string; amountPence: number; invoiceId: string }) {
  const body = page(`Payment failed: ${c.clubName}`, [
    ["Club", c.clubName],
    ["Amount", `£${(c.amountPence / 100).toFixed(2)}`],
    ["When", when()],
  ], "Stripe will retry automatically and email them. They can update their card from Settings, Billing.");
  await sendEmail({ to: to(), subject: `Payment failed: ${c.clubName}`, ...body, template: "alert-payment-failed", clubId: c.clubId, dedupeKey: `alert-failed:${c.invoiceId}` }).catch((e) =>
    console.error("payment failed alert failed", e),
  );
}
