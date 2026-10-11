export const PROVIDERS = ["stripe", "gocardless"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export type ConnectedAccount = { provider: ProviderId; accountId: string; accessToken?: string };

export type SetupItem = { studentId: string; planId: string; name: string; amountPence: number; interval: "monthly" | "annual" };

export type StartSetupInput = {
  setupId: string;
  email: string;
  firstName: string;
  lastName: string;
  items: SetupItem[];
  /** One-off sign-up fee for everyone in this set-up, taken with the first payment. 0 = none. */
  signupFeePence?: number;
  successUrl: string;
  cancelUrl: string;
};

export type OnboardInput = {
  clubId: string;
  clubName: string;
  email: string;
  /** Where Stripe sends them back, given the account id (wrapped in signed state). */
  returnUrl: (accountId: string) => string;
  /** Where Stripe sends them if the link expires: starts again. */
  refreshUrl: string;
};

export interface PaymentProvider {
  id: ProviderId;
  name: string;
  /** True when Junbi's own platform keys for this provider are set. */
  available(): boolean;
  connectUrl(state: string, redirectUri: string): string;
  completeConnect(code: string, redirectUri: string): Promise<{ accountId: string; accessToken?: string }>;
  /**
   * Hosted sign-up instead of OAuth (Stripe): makes (or reuses) the club's own account and returns the
   * provider page where the owner fills in their details. The return URL carries the account id in a signed state.
   */
  onboard?(input: OnboardInput): Promise<string>;
  /** After hosted sign-up: whether the owner finished, so the account can be saved. */
  finishOnboard?(accountId: string): Promise<{ accountId: string; submitted: boolean; chargesEnabled: boolean }>;
  /** Starts Direct Debit set-up on the club's account. Returns the provider page to send the parent to. */
  startSetup(account: ConnectedAccount, input: StartSetupInput): Promise<{ ref: string; url: string }>;
}
