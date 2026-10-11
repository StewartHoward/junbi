import { createHash } from "node:crypto";

/*
 * Netlify scheduled function: every hour, asks the app to remind leads whose free trial session
 * is in the next 24 hours. The app does the work; this just knocks on the door.
 */
export default async () => {
  const base = process.env.URL;
  if (!base) return new Response("No site URL", { status: 500 });
  const key = createHash("sha256").update(`junbi-cron:${process.env.DATABASE_URL ?? ""}`).digest("hex");
  const res = await fetch(`${base}/api/cron/lead-reminders`, { method: "POST", headers: { authorization: `Bearer ${key}` } });
  const body = await res.text();
  console.log(`lead reminders: ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "5 * * * *" };
