import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Secrets for payments. PAYMENTS_SECRET can be set; otherwise a key is derived from DATABASE_URL,
 * which the app always has (same approach as the cron key).
 */
const key = () => createHash("sha256").update(process.env.PAYMENTS_SECRET || `junbi-payments:${process.env.DATABASE_URL ?? ""}`).digest();

/** AES-256-GCM. Output: iv.tag.ciphertext, base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/** Signed, short-lived "state" for the connect round trip, so a callback can't be forged. */
export function signState(data: { clubId: string; provider: string; accountId?: string }, ttlSeconds = 1800): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string | null | undefined): { clubId: string; provider: string; accountId?: string } | null {
  if (!state || state.length > 1000) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString()) as { clubId: string; provider: string; accountId?: string; exp: number };
    return d.exp > Date.now() / 1000 ? { clubId: d.clubId, provider: d.provider, ...(d.accountId ? { accountId: d.accountId } : {}) } : null;
  } catch {
    return null;
  }
}

/** Constant-time compare of two hex or text signatures. */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * A signed link token for one purpose (e.g. "pay"), so a token made for one job can't be used for another.
 * Output: body.signature, both base64url.
 */
export function signLink<T extends Record<string, string>>(purpose: string, data: T, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, p: purpose, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", key()).update(`link:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyLink<T extends Record<string, string>>(purpose: string, token: unknown): T | null {
  if (typeof token !== "string" || token.length > 1000) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", key()).update(`link:${body}`).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { p: string; exp: number };
    if (d.p !== purpose || !(d.exp > Date.now() / 1000)) return null;
    const { p: _p, exp: _e, ...rest } = d;
    return rest as unknown as T;
  } catch {
    return null;
  }
}
