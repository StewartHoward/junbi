import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Key for scheduled jobs calling the app. Derived from DATABASE_URL, which both the app and
 * Netlify's scheduled functions already have, so there's no extra secret to manage.
 */
export function cronKey() {
  return createHash("sha256").update(`junbi-cron:${process.env.DATABASE_URL ?? ""}`).digest("hex");
}

export function cronAuthorised(header: string | null) {
  if (!process.env.DATABASE_URL || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(cronKey());
  return given.length === expected.length && timingSafeEqual(given, expected);
}
