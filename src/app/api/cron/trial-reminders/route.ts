import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron";
import { sendTrialReminders } from "@/data/email-flows";

export const dynamic = "force-dynamic";

/** Called once a day by netlify/functions/trial-reminders.mts. Safe to call twice: each reminder only goes once. */
export async function POST(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const result = await sendTrialReminders();
  return NextResponse.json(result);
}
