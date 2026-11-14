import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron";
import { runMarketingSends } from "@/data/marketing";

export const dynamic = "force-dynamic";

/** Called every hour by netlify/functions/marketing-sends.mts. Sends only on weekdays, 9am to 5pm UK time. */
export async function POST(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  return NextResponse.json(await runMarketingSends());
}
