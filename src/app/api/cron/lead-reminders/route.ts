import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron";
import { sendLeadReminders } from "@/data/leads";

export const dynamic = "force-dynamic";

/** Called every hour by netlify/functions/lead-reminders.mts. Safe to call twice: each reminder only goes once. */
export async function POST(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return NextResponse.json(await sendLeadReminders());
}
