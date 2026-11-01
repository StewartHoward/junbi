import "server-only";
import * as s from "@/db/schema";
import type { Tx } from "@/db/client";
import { decrypt } from "@/lib/payments/crypto";
import type { ConnectedAccount, ProviderId } from "@/lib/payments/types";

/*
 * One-off card payments (gradings, events, the shop) through Stripe Checkout on the club's own Stripe
 * account. The money goes straight to the club. Clubs on GoCardless, or with no payments set up, take
 * payment at the club instead.
 */

export async function accountFor(tx: Tx): Promise<ConnectedAccount | null> {
  const [a] = await tx.select().from(s.clubPaymentAccounts);
  if (!a) return null;
  return { provider: a.provider as ProviderId, accountId: a.accountId, accessToken: a.accessTokenEnc ? decrypt(a.accessTokenEnc) : undefined };
}

/** The club's Stripe account, if it can take card payments. */
export async function cardAccount(tx: Tx): Promise<ConnectedAccount | null> {
  const a = await accountFor(tx);
  if (!a || a.provider !== "stripe") return null;
  if (process.env.PAYMENTS_FAKE === "1") return a;
  const { ownStripe } = await import("@/lib/payments/stripe");
  return ownStripe(a) || process.env.STRIPE_SECRET_KEY ? a : null;
}

export type CardLine = { name: string; unitPence: number; quantity: number };

/** Opens a Stripe card page. successUrl may contain {CHECKOUT_SESSION_ID}. */
export async function startCardCheckout(
  account: ConnectedAccount,
  input: { lines: CardLine[]; email: string | null; successUrl: string; cancelUrl: string; metadata: Record<string, string>; description: string; fakeKey: string },
): Promise<{ id: string; url: string }> {
  if (process.env.PAYMENTS_FAKE === "1") {
    const id = `cs_fake_${input.fakeKey}`;
    return { id, url: `${input.successUrl.replace("{CHECKOUT_SESSION_ID}", id)}${input.successUrl.includes("?") ? "&" : "?"}fake=1` };
  }
  const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
  const auth = stripeAuth(account);
  return stripeApi<{ id: string; url: string }>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      ...(input.email ? { customer_email: input.email } : {}),
      line_items: input.lines.map((l) => ({ quantity: l.quantity, price_data: { currency: "gbp", unit_amount: l.unitPence, product_data: { name: l.name.slice(0, 250) } } })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata, description: input.description.slice(0, 250) },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    auth.account,
    undefined,
    auth.key,
  );
}

export const validSessionId = (id: string) => /^cs_[A-Za-z0-9_-]{1,200}$/.test(id);

/** Asks Stripe whether a card page has been paid. */
export async function cardSessionPaid(account: ConnectedAccount, sessionId: string): Promise<boolean> {
  if (!validSessionId(sessionId)) return false;
  if (process.env.PAYMENTS_FAKE === "1" && sessionId.startsWith("cs_fake_")) return true;
  const { stripeApi, stripeAuth } = await import("@/lib/payments/stripe");
  const auth = stripeAuth(account);
  const session = await stripeApi<{ payment_status: string }>("GET", `/checkout/sessions/${sessionId}`, null, auth.account, undefined, auth.key).catch(() => null);
  return session?.payment_status === "paid";
}
