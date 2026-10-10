import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";
import type { ConnectedAccount, PaymentProvider, StartSetupInput } from "./types";

/*
 * Stripe Connect with Standard accounts: each club has its own Stripe account and connects it to Junbi
 * through OAuth. Charges, customers and Bacs Direct Debit mandates live on the club's account,
 * so Junbi never holds money and mandates stay with the club if Junbi's platform account changes.
 * Env: STRIPE_SECRET_KEY (platform), STRIPE_CONNECT_CLIENT_ID (ca_…), STRIPE_WEBHOOK_SECRET (whsec_…, Connect endpoint).
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
  available: () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID),
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
        line_items: input.items.map((i) => ({
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: i.amountPence,
            recurring: { interval: i.interval === "annual" ? "year" : "month" },
            product_data: { name: i.name, metadata: { junbi_student_id: i.studentId, junbi_plan_id: i.planId } },
          },
        })),
      },
      account.accountId,
      `setup-${input.setupId}`,
    );
    return { ref: session.id, url: session.url };
  },
};
