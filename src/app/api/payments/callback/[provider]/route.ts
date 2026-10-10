import { NextResponse } from "next/server";
import { currentActor } from "@/auth/session";
import { finishConnect } from "@/data/payments";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Back from Stripe or GoCardless after the owner connected (or cancelled). */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const actor = await currentActor();
  const base = await appUrl();
  if (!actor) return NextResponse.redirect(`${base}/login`);
  const { provider } = await params;
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return NextResponse.redirect(`${base}/payments?error=cancelled`);
  const r = await finishConnect(actor, provider, q.get("code"), q.get("state"), `${base}/api/payments/callback/${provider}`);
  if (!r.ok) return NextResponse.redirect(`${base}/payments?error=${encodeURIComponent(r.errors.form ?? "failed")}`);
  return NextResponse.redirect(`${base}/payments?connected=${r.value.provider}`);
}
