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
  successUrl: string;
  cancelUrl: string;
};

export interface PaymentProvider {
  id: ProviderId;
  name: string;
  /** True when Junbi's own platform keys for this provider are set. */
  available(): boolean;
  connectUrl(state: string, redirectUri: string): string;
  completeConnect(code: string, redirectUri: string): Promise<{ accountId: string; accessToken?: string }>;
  /** Starts Direct Debit set-up on the club's account. Returns the provider page to send the parent to. */
  startSetup(account: ConnectedAccount, input: StartSetupInput): Promise<{ ref: string; url: string }>;
}
