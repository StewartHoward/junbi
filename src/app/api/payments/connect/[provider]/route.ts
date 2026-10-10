import { NextResponse } from "next/server";
import { currentActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { connectUrl } from "@/data/payments";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Sends the club owner to Stripe or GoCardless to connect their account. */
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const actor = await currentActor();
  const base = await appUrl();
  if (!actor || !can(actor, "club.manage")) return NextResponse.redirect(`${base}/login`);
  const { provider } = await params;
  try {
    return NextResponse.redirect(connectUrl(actor, provider, `${base}/api/payments/callback/${provider}`));
  } catch {
    return NextResponse.redirect(`${base}/payments?error=unavailable`);
  }
}
