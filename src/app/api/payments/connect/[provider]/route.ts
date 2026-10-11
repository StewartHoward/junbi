import { NextResponse } from "next/server";
import { currentActor, currentUser } from "@/auth/session";
import { can } from "@/auth/permissions";
import { startConnect } from "@/data/payments";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Sends the club owner to Stripe or GoCardless to connect their account. */
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const actor = await currentActor();
  const base = await appUrl();
  if (!actor || !can(actor, "club.manage")) return NextResponse.redirect(`${base}/login`);
  const { provider } = await params;
  try {
    const user = await currentUser();
    return NextResponse.redirect(await startConnect(actor, provider, base, user?.email ?? ""));
  } catch (err) {
    console.error("Connecting payments failed", err);
    return NextResponse.redirect(`${base}/payments?error=unavailable`);
  }
}
