import { NextResponse } from "next/server";
import { marketingUnsubscribe } from "@/data/marketing";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058). Mail apps POST here from the "Unsubscribe" button they show next to the sender,
 * using the List-Unsubscribe header on every marketing email. A GET does nothing, so link scanners can't unsubscribe anyone.
 */
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const done = await marketingUnsubscribe(t);
  return NextResponse.json({ done }, { status: done ? 200 : 400 });
}
