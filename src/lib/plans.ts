/** Junbi plans. One source for the pricing page, sign-up form and (later) billing. Prices in pence, ex VAT. */
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    for: "For a new club or a single hall class.",
    monthlyPence: 1900,
    annualPence: 19000,
    limits: "Up to 50 active students · 1 site",
    intro: null,
    features: ["Student profiles and families", "Direct Debit and card payments", "Gradings and registers", "Junbi Family app and kiosk", "Unlimited staff logins"],
  },
  {
    id: "club",
    name: "Club",
    for: "For the typical established club.",
    monthlyPence: 3900,
    annualPence: 39000,
    limits: "Up to 150 active students · 1 site",
    intro: "Everything in Starter, plus:",
    features: ["Automatic failed-payment recovery", "Ready-to-grade alerts", "Trial booking and follow-ups", "Online shop"],
  },
  {
    id: "academy",
    name: "Academy",
    for: "For schools running more than one site.",
    monthlyPence: 6900,
    annualPence: 69000,
    limits: "Unlimited students · up to 3 sites",
    intro: "Everything in Club, plus:",
    features: ["Multi-site dashboard", "Transfers between sites", "Custom staff roles", "Priority support"],
  },
  {
    id: "association",
    name: "Association",
    for: "For associations and instructor groups.",
    monthlyPence: 14900,
    annualPence: 149000,
    limits: "5 member clubs, then £15 per club",
    intro: "Everything in Academy, plus:",
    features: ["Shared licence register", "Association grading events", "Certificates across clubs", "Head-office view"],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];

export function formatPounds(pence: number) {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: pounds % 1 ? 2 : 0 })}`;
}
