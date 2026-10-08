import { createHash } from "node:crypto";

/*
 * Netlify scheduled function: every morning, asks the app to email owners whose free trial
 * ends in 7, 3 or 1 days. The app does the work; this just knocks on the door.
 */
export default async () => {
  const base = process.env.URL;
  if (!base) return new Response("No site URL", { status: 500 });
  const key = createHash("sha256").update(`junbi-cron:${process.env.DATABASE_URL ?? ""}`).digest("hex");
  const res = await fetch(`${base}/api/cron/trial-reminders`, { method: "POST", headers: { authorization: `Bearer ${key}` } });
  const body = await res.text();
  console.log(`trial reminders: ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

// 08:00 UTC is 9am in UK summer time, 8am in winter.
export const config = { schedule: "0 8 * * *" };
