import { goCardlessProvider } from "./gocardless";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, ProviderId } from "./types";

export * from "./types";

/** In tests (PAYMENTS_FAKE=1) a fake provider stands in for both, so the whole flow runs without real accounts. */
const fake = (id: ProviderId): PaymentProvider => ({
  id,
  name: id === "stripe" ? "Stripe" : "GoCardless",
  available: () => true,
  connectUrl: (state, redirectUri) => `${redirectUri}?code=fake-code&state=${encodeURIComponent(state)}`,
  completeConnect: async () => ({ accountId: `fake_${id}_${Math.random().toString(36).slice(2, 10)}`, accessToken: id === "gocardless" ? "fake-token" : undefined }),
  startSetup: async (_a, input) => ({ ref: `fake_ref_${input.setupId}`, url: `${input.successUrl}&fake=1` }),
});

export function provider(id: ProviderId): PaymentProvider {
  if (process.env.PAYMENTS_FAKE === "1") return fake(id);
  return id === "stripe" ? stripeProvider : goCardlessProvider;
}
