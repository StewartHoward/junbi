/**
 * Junbi plans. One source for the pricing page, sign-up form, settings and (later) billing.
 * Prices are in pence, ex VAT. Every plan has every feature; plans differ only by club size and sites.
 */

/** What every plan includes. */
export const CORE_FEATURES = [
  "Student profiles and families",
  "Belts for every art you teach",
  "Timetable and tap-to-mark registers",
  "Direct Debit through your own GoCardless",
  "Email and text messages to parents",
  "Unlimited staff logins",
] as const;

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    for: "For a new club or a single hall class.",
    monthlyPence: 1900,
    limits: "Up to 50 active students · 1 site",
  },
  {
    id: "club",
    name: "Club",
    for: "For the typical established club.",
    monthlyPence: 3900,
    limits: "Up to 150 active students · 1 site",
  },
  {
    id: "academy",
    name: "Academy",
    for: "For clubs running more than one site.",
    monthlyPence: 6900,
    limits: "Unlimited students · up to 3 sites",
  },
  {
    id: "association",
    name: "Association",
    for: "For groups running several clubs.",
    monthlyPence: 14900,
    limits: "5 clubs, then £15 per club",
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];

/** Plans a club can pick itself. Association is set up with Junbi. */
export const SELF_SERVE_IDS = ["starter", "club", "academy"] as const;
export const SELF_SERVE_PLANS = PLANS.filter((p) => p.id !== "association");

export const planName = (id: string) => PLANS.find((p) => p.id === id)?.name ?? id;

/** Annual billing: two months free. */
export const annualPence = (monthly: number) => monthly * 10;

export function formatPounds(pence: number) {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: pounds % 1 ? 2 : 0 })}`;
}
