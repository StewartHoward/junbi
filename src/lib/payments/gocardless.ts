import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";
import type { ConnectedAccount, PaymentProvider, StartSetupInput } from "./types";

/*
 * GoCardless as a partner app: each club connects its own GoCardless account through OAuth and we keep
 * its access token (encrypted). Mandates and payments live on the club's account.
 * Env: GOCARDLESS_CLIENT_ID, GOCARDLESS_CLIENT_SECRET, GOCARDLESS_WEBHOOK_SECRET, GOCARDLESS_ENV ("sandbox" or "live").
 */

const live = () => process.env.GOCARDLESS_ENV === "live";
const connectBase = () => (live() ? "https://connect.gocardless.com" : "https://connect-sandbox.gocardless.com");
const apiBase = () => (live() ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com");

export async function gcApi<T>(token: string, method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "GoCardless-Version": "2015-07-06",
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: Array<{ reason?: string; links?: { conflicting_resource_id?: string } }> } };
  // A retried create with the same idempotency key: GoCardless says "already made" and gives the id. Fetch that one.
  const conflict = json.error?.errors?.find((e) => e.reason === "idempotent_creation_conflict")?.links?.conflicting_resource_id;
  if (res.status === 409 && method === "POST" && conflict) return gcApi<T>(token, "GET", `${path}/${conflict}`);
  if (!res.ok) throw new Error(json.error?.message ?? `GoCardless error ${res.status}`);
  return json;
}

/** GoCardless signs the raw body with HMAC-SHA256 (hex) in the Webhook-Signature header. */
export function verifyGoCardlessSignature(payload: string, header: string | null, secret = process.env.GOCARDLESS_WEBHOOK_SECRET ?? ""): boolean {
  if (!header || !secret) return false;
  return safeEqual(header, createHmac("sha256", secret).update(payload).digest("hex"));
}

export const goCardlessProvider: PaymentProvider = {
  id: "gocardless",
  name: "GoCardless",
  available: () => Boolean(process.env.GOCARDLESS_CLIENT_ID && process.env.GOCARDLESS_CLIENT_SECRET),
  connectUrl(state, redirectUri) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: process.env.GOCARDLESS_CLIENT_ID ?? "",
      scope: "read_write",
      redirect_uri: redirectUri,
      state,
      initial_view: "login",
    });
    return `${connectBase()}/oauth/authorize?${q}`;
  },
  async completeConnect(code, redirectUri) {
    const res = await fetch(`${connectBase()}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.GOCARDLESS_CLIENT_ID ?? "",
        client_secret: process.env.GOCARDLESS_CLIENT_SECRET ?? "",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; organisation_id?: string; error_description?: string };
    if (!res.ok || !json.access_token || !json.organisation_id) throw new Error(json.error_description ?? "GoCardless didn't connect.");
    return { accountId: json.organisation_id, accessToken: json.access_token };
  },
  async startSetup(account: ConnectedAccount, input: StartSetupInput) {
    if (!account.accessToken) throw new Error("This club's GoCardless account needs reconnecting.");
    const br = await gcApi<{ billing_requests: { id: string } }>(
      account.accessToken,
      "POST",
      "/billing_requests",
      { billing_requests: { mandate_request: { scheme: "bacs", currency: "GBP" }, metadata: { junbi_setup_id: input.setupId } } },
      `br-${input.setupId}`,
    );
    const flow = await gcApi<{ billing_request_flows: { authorisation_url: string } }>(
      account.accessToken,
      "POST",
      "/billing_request_flows",
      {
        billing_request_flows: {
          redirect_uri: input.successUrl,
          exit_uri: input.cancelUrl,
          prefilled_customer: { given_name: input.firstName, family_name: input.lastName, email: input.email },
          links: { billing_request: br.billing_requests.id },
        },
      },
      `brf-${input.setupId}`,
    );
    return { ref: br.billing_requests.id, url: flow.billing_request_flows.authorisation_url };
  },
};
