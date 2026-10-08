/**
 * Junbi plans. One source for the pricing page, sign-up form and (later) billing.
 * Prices are in pence, ex VAT, and follow the club's active students: the band is
 * worked out automatically each month, so clubs never pick a size.
 */

export const SIZE_BANDS = [
  { id: "s", label: "Up to 50", max: 50 },
  { id: "m", label: "51 to 150", max: 150 },
  { id: "l", label: "151 to 300", max: 300 },
  { id: "xl", label: "300+", max: Infinity },
] as const;
export type SizeBandId = (typeof SIZE_BANDS)[number]["id"];

export const PLANS = [
  {
    id: "essentials",
    name: "Essentials",
    for: "Everything you need to run classes, take payments and keep families in the loop.",
    monthlyPence: { s: 1900, m: 2900, l: 3900, xl: 5900 },
    limits: "1 site",
    intro: null,
    features: [
      "Student profiles and families",
      "Timetable and tap-to-mark registers",
      "Direct Debit and card payments",
      "Email and SMS to parents",
      "Belt tracking for every student",
      "Staff logins with roles",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    for: "For clubs that want gradings, a family app and less admin.",
    monthlyPence: { s: 3500, m: 4900, l: 6900, xl: 9900 },
    limits: "Unlimited sites",
    intro: "Everything in Essentials, plus:",
    features: [
      "Gradings with scoring sheets and certificates",
      "Family portal and app",
      "Grading, camp and event bookings",
      "Missed-payment chasing and reminders",
      "Licence, insurance and first-aid tracking",
      "Online shop",
      "Video feedback between classes",
    ],
  },
  {
    id: "association",
    name: "Association",
    for: "For associations and instructor groups running many clubs.",
    monthlyPence: { s: 14900, m: 14900, l: 14900, xl: 14900 },
    limits: "5 member clubs, then £15 per club",
    intro: "Everything in Pro, plus:",
    features: ["Shared licence register", "Association grading events", "Certificates across clubs", "Head-office view"],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];
/** Plans a club can pick when signing up. Association is set up with us. */
export const SELF_SERVE_PLANS = PLANS.filter((p) => p.id !== "association");

export const planName = (id: string) => PLANS.find((p) => p.id === id)?.name ?? id;

/** Annual billing: two months free. */
export const annualPence = (monthly: number) => monthly * 10;

export function formatPounds(pence: number) {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: pounds % 1 ? 2 : 0 })}`;
}

/** Feature comparison for the pricing page. */
export const COMPARE: Array<{ group: string; rows: Array<{ label: string; essentials: boolean | string; pro: boolean | string }> }> = [
  {
    group: "Members",
    rows: [
      { label: "Student profiles, families and medical notes", essentials: true, pro: true },
      { label: "Belt tracking and grading history", essentials: true, pro: true },
      { label: "Saved filters and bulk actions", essentials: false, pro: true },
      { label: "Licence, insurance and first-aid expiry tracking", essentials: false, pro: true },
    ],
  },
  {
    group: "Classes",
    rows: [
      { label: "Weekly timetable and registers", essentials: true, pro: true },
      { label: "Sites", essentials: "1", pro: "Unlimited" },
      { label: "iPad check-in kiosk", essentials: false, pro: true },
      { label: "Printable timetables for each venue", essentials: false, pro: true },
    ],
  },
  {
    group: "Payments",
    rows: [
      { label: "Direct Debit through your own GoCardless", essentials: true, pro: true },
      { label: "Card payments through your own Stripe", essentials: true, pro: true },
      { label: "Family discounts and price caps", essentials: true, pro: true },
      { label: "Arrears view with one-tap chasing", essentials: false, pro: true },
      { label: "Automatic receipts and reminders", essentials: false, pro: true },
    ],
  },
  {
    group: "Messages",
    rows: [
      { label: "Email and SMS to a class, site or everyone", essentials: true, pro: true },
      { label: "Your club's name and reply-to address", essentials: true, pro: true },
      { label: "Scheduled messages and delivery tracking", essentials: false, pro: true },
    ],
  },
  {
    group: "Gradings",
    rows: [
      { label: "Ready-to-grade list", essentials: true, pro: true },
      { label: "Tablet scoring with your syllabus", essentials: false, pro: true },
      { label: "Certificate designer and bulk printing", essentials: false, pro: true },
    ],
  },
  {
    group: "Families",
    rows: [
      { label: "Family portal and app for iPhone and Android", essentials: false, pro: true },
      { label: "Bookings for gradings, camps and competitions", essentials: false, pro: true },
      { label: "Online shop for kit and merchandise", essentials: false, pro: true },
      { label: "Video feedback between classes", essentials: false, pro: true },
    ],
  },
];
