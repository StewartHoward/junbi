import { NextResponse } from "next/server";
import { startFamilySession } from "@/data/family";

export const dynamic = "force-dynamic";

/** The link in the sign-in email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ok = await startFamilySession(url.searchParams.get("token"));
  return NextResponse.redirect(new URL(ok ? "/family/home" : "/family?expired=1", url), 303);
}
