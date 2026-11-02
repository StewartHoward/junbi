import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron";
import { sendLibraryFollowups } from "@/data/crm";

export const dynamic = "force-dynamic";

/** Called every hour by netlify/functions/library-followups.mts. Safe to call twice: each email only goes once. */
export async function POST(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return NextResponse.json(await sendLibraryFollowups());
}
