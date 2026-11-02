import { createHash } from "node:crypto";

/*
 * Netlify scheduled function: every hour, asks the app to send any Junbi Library follow-up emails that are due.
 * The app does the work; this just knocks on the door.
 */
export default async () => {
  const base = process.env.URL;
  if (!base) return new Response("No site URL", { status: 500 });
  const key = createHash("sha256").update(`junbi-cron:${process.env.DATABASE_URL ?? ""}`).digest("hex");
  const res = await fetch(`${base}/api/cron/library-followups`, { method: "POST", headers: { authorization: `Bearer ${key}` } });
  const body = await res.text();
  console.log(`library follow-ups: ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "20 * * * *" };
