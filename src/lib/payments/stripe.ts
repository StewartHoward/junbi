import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";
import type { ConnectedAccount, PaymentProvider, StartSetupInput } from "./types";

/*
 * Stripe Connect: each club has its own full Stripe account (with its own Stripe Dashboard, paying its own
 * Stripe fees). Junbi creates it and the owner fills in their details on Stripe's hosted sign-up; anyone
 * already on Stripe can reuse their saved details. Charges, customers and Bacs Direct Debit mandates live
 * on the club's account, so Junbi never holds money.
 * Env: STRIPE_SECRET_KEY (platform), STRIPE_WEBHOOK_SECRET (whsec_…, Connect endpoint).
 * STRIPE_CONNECT_CLIENT_ID is no longer needed (it was for the old OAuth connect).
 */

const API = "https://api.stripe.com/v1";

/** Stripe's form encoding, including nested objects and arrays: a[b][0][c]=1 */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => parts.push(typeof item === "object" ? formEncode(item as Record<string, unknown>, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else if (typeof v === "object") parts.push(formEncode(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

export async function stripeApi<T>(method: "GET" | "POST" | "DELETE", path: string, params: Record<string, unknown> | null, account?: string, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up for Junbi yet.");
  const body = params && method !== "GET" ? formEncode(params) : undefined;
  const url = params && method === "GET" ? `${API}${path}?${formEncode(params)}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(account ? { "Stripe-Account": account } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

/** Checks the Stripe-Signature header: t=…,v1=… with HMAC-SHA256 of "t.payload". Allows 5 minutes of clock drift. */
export function verifyStripeSignature(payload: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET ?? "", now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => safeEqual(p.slice(3), expected));
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  name: "Stripe",
  available: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async onboard(input) {
    // Reuse the club's unfinished account if they started before, so abandoned sign-ups don't pile up.
    const list = await stripeApi<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>("GET", "/accounts", { limit: 100 });
    let accountId = list.data.find((a) => a.metadata?.junbi_club_id === input.clubId)?.id;
    if (!accountId) {
      const acct = await stripeApi<{ id: string }>(
        "POST",
        "/accounts",
        {
          country: "GB",
          email: input.email,
          business_profile: { name: input.clubName.slice(0, 100), mcc: "7941", product_description: "Martial arts club memberships" },
          controller: {
            stripe_dashboard: { type: "full" },
            fees: { payer: "account" },
            losses: { payments: "stripe" },
            requirement_collection: "stripe",
          },
          capabilities: { bacs_debit_payments: { requested: true }, card_payments: { requested: true } },
          metadata: { junbi_club_id: input.clubId },
        },
        undefined,
        `acct-${input.clubId}`,
      );
      accountId = acct.id;
    }
    const link = await stripeApi<{ url: string }>("POST", "/account_links", {
      account: accountId,
      type: "account_onboarding",
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl(accountId),
    });
    return link.url;
  },
  async finishOnboard(accountId) {
    const a = await stripeApi<{ id: string; details_submitted?: boolean; charges_enabled?: boolean }>("GET", `/accounts/${accountId}`, null);
    return { accountId: a.id, submitted: Boolean(a.details_submitted), chargesEnabled: Boolean(a.charges_enabled) };
  },
  connectUrl(state, redirectUri) {
    const q = new URLSearchParams({ response_type: "code", client_id: process.env.STRIPE_CONNECT_CLIENT_ID ?? "", scope: "read_write", state, redirect_uri: redirectUri });
    return `https://connect.stripe.com/oauth/authorize?${q}`;
  },
  async completeConnect(code) {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    const res = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code }),
    });
    const json = (await res.json().catch(() => ({}))) as { stripe_user_id?: string; error_description?: string };
    if (!res.ok || !json.stripe_user_id) throw new Error(json.error_description ?? "Stripe didn't connect.");
    return { accountId: json.stripe_user_id };
  },
  async startSetup(account: ConnectedAccount, input: StartSetupInput) {
    const session = await stripeApi<{ id: string; url: string }>(
      "POST",
      "/checkout/sessions",
      {
        mode: "subscription",
        payment_method_types: ["bacs_debit"],
        customer_email: input.email,
        client_reference_id: input.setupId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { junbi_setup_id: input.setupId },
        subscription_data: { metadata: { junbi_setup_id: input.setupId } },
        line_items: [
          ...input.items.map((i) => ({
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: i.amountPence,
              recurring: { interval: i.interval === "annual" ? "year" : "month" },
              product_data: { name: i.name, metadata: { junbi_student_id: i.studentId, junbi_plan_id: i.planId } },
            },
          })),
          // One-off: Stripe adds it to the first invoice only.
          ...(input.signupFeePence ? [{ quantity: 1, price_data: { currency: "gbp", unit_amount: input.signupFeePence, product_data: { name: "Sign-up fee", metadata: { junbi_fee: "signup" } } } }] : []),
        ],
      },
      account.accountId,
      `setup-${input.setupId}`,
    );
    return { ref: session.id, url: session.url };
  },
};
