import { redirect } from "next/navigation";
import { requireActorForSetup } from "@/auth/session";
import { finishBillingCheckout } from "@/data/billing";

/** Back from Stripe Checkout: save the card and subscription, then carry on into Junbi. */
export default async function BillingDonePage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const actor = await requireActorForSetup();
  const { session_id } = await searchParams;
  const ok = session_id ? await finishBillingCheckout(actor, session_id).catch((err) => { console.error("billing finish failed", err); return false; }) : false;
  redirect(ok ? (actor.onboarded ? "/today" : "/setup") : "/billing");
}
