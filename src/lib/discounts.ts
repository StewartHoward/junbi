/** Codes are stored in capitals with no spaces, so "summer 20" and "SUMMER20" are the same code. */
export function cleanCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

/** A price with a percentage off, rounded to the nearest penny. */
export function discounted(pence: number, percent: number): number {
  if (!percent) return pence;
  return Math.max(0, Math.round((pence * (100 - Math.min(100, Math.max(0, percent)))) / 100));
}

/** A short, easy-to-read code for one family: no 0/O or 1/I to mix up. */
export function randomCode(prefix = ""): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  const p = cleanCode(prefix).replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return p ? `${p}-${out}` : out;
}
