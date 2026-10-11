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

export async function stripeApi<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, unknown> | null,
  account?: string,
  idempotencyKey?: string,
  /** A club's own key (clubs that connected their existing Stripe account). Used instead of Junbi's key. */
  ownKey?: string,
): Promise<T> {
  const key = ownKey || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up for Junbi yet.");
  if (ownKey) account = undefined;
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

/**
 * Clubs that connect their existing Stripe account paste a key; we store it (encrypted) as JSON along with
 * the webhook Junbi created on their account: { key, whsec, whId }.
 */
export type OwnStripe = { key: string; whsec: string; whId: string };
export function ownStripe(account: Pick<ConnectedAccount, "provider" | "accessToken"> | null | undefined): OwnStripe | null {
  if (!account || account.provider !== "stripe" || !account.accessToken) return null;
  try {
    const v = JSON.parse(account.accessToken) as Partial<OwnStripe>;
    return v.key ? { key: v.key, whsec: v.whsec ?? "", whId: v.whId ?? "" } : null;
  } catch {
    return null;
  }
}
/** How to call Stripe for a club: on its own key, or as Junbi on behalf of its connected account. */
export function stripeAuth(account: ConnectedAccount): { account?: string; key?: string } {
  const own = ownStripe(account);
  return own ? { key: own.key } : { account: account.accountId };
}

export const WEBHOOK_EVENTS = ["checkout.session.completed", "mandate.updated", "invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"];

/** Stripe's newer v2 API (JSON in and out), used for creating clubs' accounts. */
const V2_VERSION = "2026-09-30.endive";
export async function stripeV2<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up for Junbi yet.");
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Stripe-Version": V2_VERSION,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
    const list = await stripeApi<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>("GET", "/accounts", { limit: 100 }).catch(() => ({ data: [] }));
    let accountId = list.data.find((a) => a.metadata?.junbi_club_id === input.clubId)?.id;
    if (!accountId) {
      // A full Stripe account the club owns: its own Stripe Dashboard, it pays its own Stripe fees, Stripe covers losses.
      const acct = await stripeV2<{ id: string }>(
        "POST",
        "/v2/core/accounts",
        {
          ...(input.email ? { contact_email: input.email } : {}),
          display_name: input.clubName.slice(0, 100),
          dashboard: "full",
          identity: { country: "gb" },
          configuration: {
            merchant: {
              capabilities: { card_payments: { requested: true }, bacs_debit_payments: { requested: true } },
            },
          },
          defaults: { currency: "gbp", responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
          metadata: { junbi_club_id: input.clubId },
        },
        `acct-v2-${input.clubId}-${new Date().toISOString().slice(0, 10)}`,
      );
      accountId = acct.id;
    }
    const link = await stripeV2<{ url: string }>("POST", "/v2/core/account_links", {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: { refresh_url: input.refreshUrl, return_url: input.returnUrl(accountId) },
      },
    });
    return link.url;
  },
  async finishOnboard(accountId) {
    try {
      const a = await stripeApi<{ id: string; details_submitted?: boolean; charges_enabled?: boolean }>("GET", `/accounts/${accountId}`, null);
      return { accountId: a.id, submitted: Boolean(a.details_submitted), chargesEnabled: Boolean(a.charges_enabled) };
    } catch {
      // Stripe only sends people back here when they've finished or chosen to stop; save it and let Stripe finish checks.
      const a = await stripeV2<{ id: string }>("GET", `/v2/core/accounts/${encodeURIComponent(accountId)}`);
      return { accountId: a.id, submitted: true, chargesEnabled: false };
    }
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
      stripeAuth(account).account,
      `setup-${input.setupId}`,
      stripeAuth(account).key,
    );
    return { ref: session.id, url: session.url };
  },
};
