import type { MarketingContent } from "./marketing-email";

/*
 * Ready-made emails for Admin → Marketing. "Use this" copies one into a new draft, so editing a draft
 * never changes these. Prices and competitor figures come from src/lib/plans.ts and each provider's own
 * pricing page (checked 14 November 2026). Check them again before reusing this in a later month.
 */

export type MarketingTemplate = {
  key: string;
  name: string;
  /** Sent this many days after the email before it in the sequence (0 for the first). */
  delayDays: number;
  content: MarketingContent;
};

const SIGNUP = "https://junbi.co.uk/signup";

export const TRIAL_SEQUENCE: MarketingTemplate[] = [
  {
    key: "trial-1",
    name: "Try Junbi for 7 days (1 of 3): the invitation",
    delayDays: 0,
    content: {
      subject: "Less admin for {{club_name}}, free for 7 days",
      preheader: "Registers on your phone, Direct Debit into your own account, one flat price.",
      heading: "Your club, ready.",
      body: `Hi {{first_name}},

I'm Stewart. I built Junbi after years of doing a taekwondo club's admin by hand: paper registers, chasing late fees, and spreadsheets that never quite matched.

Junbi is simple club software for UK taekwondo clubs. It does four jobs well:

- **Students and families**, with each student's belt
- **Registers on your phone**, tap to mark in under a minute
- **Direct Debit** through your own Stripe or GoCardless account, set up by parents when they join
- **Emails** to a class, a site or the whole club

It's one flat monthly price from £19, and we never take a percentage of your fees. Parents pay straight into your account.

You can try everything free for 7 days. Most clubs are set up in an evening, and you can bring your students across from a spreadsheet.`,
      buttonLabel: "Try Junbi free for 7 days",
      buttonUrl: SIGNUP,
    },
  },
  {
    key: "trial-2",
    name: "Try Junbi for 7 days (2 of 3): the price comparison",
    delayDays: 3,
    content: {
      subject: "What club software really costs",
      preheader: "Junbi, NEST and Martialytics side by side, from their own published prices.",
      heading: "Simple pricing. Your fees stay yours.",
      body: `Hi {{first_name}},

A quick follow-up with something useful whatever you decide: what the main systems cost a UK club each month, taken from each provider's own pricing page.

| Club size | Junbi | NEST | Martialytics
| Up to 50 students | £19 | £77.94 | $69
| 100 students | £39 | £197.64 | $99
| 200 students | £69 | £392.05 | $129

Why the gap? Some systems charge a **percentage of the fees they collect** for you, so the bill grows as your club grows. Junbi is a flat price. Every feature is on every plan, and the 0% never changes.

For a club of 100 students, that's around **£1,900 a year** less than NEST's typical published fee.

To be fair to the others, they do things Junbi doesn't yet, like a member app. If what you want is simple registers, Direct Debit and emails to parents, Junbi keeps it simple and keeps the cost down.

*NEST figures are the typical monthly fees NEST publishes for clubs of that size; your own quote may differ. Martialytics prices are in US dollars. All figures checked 14 November 2026.*`,
      buttonLabel: "Start your free 7 days",
      buttonUrl: SIGNUP,
    },
  },
  {
    key: "trial-3",
    name: "Try Junbi for 7 days (3 of 3): the last note",
    delayDays: 4,
    content: {
      subject: "Last one from me, {{first_name}}",
      preheader: "Switching is easier than it looks. Here's how clubs move across.",
      heading: "Set up in an evening.",
      body: `Hi {{first_name}},

This is my last email about Junbi, so I'll keep it short.

The thing that stops most clubs switching is the hassle of moving. Here's how Junbi handles it:

- **Upload your current list.** A spreadsheet or your current system's export. Junbi matches families and belts.
- **Already on Stripe?** Junbi can take over your existing Direct Debits, so families don't need to sign up again.
- **New families** join with your sign-up link or QR code, choose a membership and set up Direct Debit in one go on their phone.

The 7-day trial has every feature switched on. Add your card when you sign up and nothing is taken until the 7 days are up. Cancel before then and you won't pay a thing.

If you have a question, just reply. It comes straight to me.`,
      buttonLabel: "Try Junbi free for 7 days",
      buttonUrl: SIGNUP,
    },
  },
];

export const TEMPLATES: MarketingTemplate[] = [...TRIAL_SEQUENCE];
export const templateByKey = (key: string) => TEMPLATES.find((t) => t.key === key) ?? null;
