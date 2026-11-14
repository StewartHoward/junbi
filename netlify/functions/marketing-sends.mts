import { createHash } from "node:crypto";

/*
 * Netlify scheduled function: every hour, asks the app to send the next few marketing emails from Admin → Marketing.
 * The app only sends on weekdays between 9am and 5pm UK time, within each campaign's daily limit.
 */
export default async () => {
  const base = process.env.URL;
  if (!base) return new Response("No site URL", { status: 500 });
  const key = createHash("sha256").update(`junbi-cron:${process.env.DATABASE_URL ?? ""}`).digest("hex");
  const res = await fetch(`${base}/api/cron/marketing`, { method: "POST", headers: { authorization: `Bearer ${key}` } });
  const body = await res.text();
  console.log(`marketing sends: ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "35 * * * *" };
