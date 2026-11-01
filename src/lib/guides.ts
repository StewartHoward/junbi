/*
 * Guides for club owners on junbi.co.uk/guides: practical, plain-English help with running and growing a club.
 * Each guide is sections of paragraphs; a paragraph starting with "- " is shown as a list item.
 */

export type Guide = { slug: string; title: string; summary: string; minutes: number; sections: Array<{ heading: string; body: string[] }> };

export const GUIDES: Guide[] = [
  {
    slug: "switching-without-re-signing-families",
    title: "Switching club software without asking families to sign up again",
    summary: "The biggest worry about changing system is the Direct Debits. Here's how to move them across quietly, with no gap and no double charges.",
    minutes: 5,
    sections: [
      {
        heading: "Why clubs put off switching",
        body: [
          "Most owners know their current system costs too much or does too little. What stops them is the thought of emailing every family to set up a new Direct Debit, chasing the ones who don't, and losing a month of income in the gap.",
          "The good news is that if your payments already run through your own Stripe account, families don't need to do anything at all. Their saved bank details stay where they are. Only the thing telling Stripe when to charge them changes.",
        ],
      },
      {
        heading: "Check where your payments actually live",
        body: [
          "Sign in to dashboard.stripe.com. If you can see your families' subscriptions there, the payments are in your account and can be moved.",
          "If you only ever see them inside your old software, they may be in the provider's account instead. Ask them directly: \"Are our Direct Debit mandates held in our own Stripe or GoCardless account, or in yours?\" You're entitled to a straight answer.",
        ],
      },
      {
        heading: "Move the people first, then the payments",
        body: [
          "- Import your students and families into the new system. Use the same parent email addresses that are in Stripe, because that's how payments get matched to families.",
          "- Set up your membership prices so each family can be put on the right one.",
          "- Take over each family's payment. The new subscription starts on the date the old one would next have charged, and the old one is set to stop on that same date. Nobody is charged twice and nobody misses a month.",
        ],
      },
      {
        heading: "Switch off the old system properly",
        body: [
          "Once payments are moved, cancel in your old software too, and check it won't try to create new subscriptions of its own. Then watch the first month's payments come in before you close the old account completely.",
          "Tell families afterwards rather than before: a short message saying you've moved to a new system, nothing changes for them, and here's the new link to sign in and update their details.",
        ],
      },
      {
        heading: "In Junbi",
        body: ["Connect your existing Stripe under Payments, import your students, then use Take over Direct Debits. Junbi matches families by email and shows you every payment before anything changes."],
      },
    ],
  },
  {
    slug: "gradings-that-run-themselves",
    title: "Running gradings that almost run themselves",
    summary: "Gradings are good for students and good for the club's income, but the admin can swallow a week. Here's a simpler way to run them.",
    minutes: 4,
    sections: [
      {
        heading: "Decide who's ready from the register, not from memory",
        body: [
          "Set a number of classes for each belt and let attendance do the work. A student who has trained the classes needed since their last grading is ready to be invited. It's fair, it's easy to explain to parents, and nobody is forgotten because they train on a quiet night.",
          "Instructors can still hold someone back or put someone forward. The numbers are a starting point, not the final word.",
        ],
      },
      {
        heading: "Take payment when they book",
        body: [
          "Asking families to pay on the day leads to cash, forgotten envelopes and last-minute no-shows. Taking payment when they book means you know exactly who's coming and the money is already in.",
          "- Send one invitation per family, not per child, so siblings are booked together.",
          "- Set a place limit if your venue or examiner needs one.",
          "- Give a clear time and what to bring: clean uniform, belt, licence if your association needs it.",
        ],
      },
      {
        heading: "Results on the day",
        body: [
          "Record results as you go, or straight after. Each pass should become the student's new belt in your records without anyone typing it in twice, so their next grading countdown starts straight away.",
          "Say \"not yet\" rather than \"fail\". Children remember the word you use.",
        ],
      },
      {
        heading: "In Junbi",
        body: ["Under Gradings, set up a grading and Junbi ticks everyone who's ready. Families book and pay by card through your own Stripe, and the results you record become their new belts."],
      },
    ],
  },
  {
    slug: "turning-trials-into-members",
    title: "Turning trial classes into members",
    summary: "Most clubs don't need more enquiries. They need more of the ones they already get to come back after their first class.",
    minutes: 4,
    sections: [
      {
        heading: "Book the trial while they're still interested",
        body: [
          "The moment someone asks about classes is the moment they're most likely to come. Book them onto a real class and date there and then, rather than \"come along whenever\". A date in the diary turns a maybe into a plan.",
          "Send the details straight away: the time, the address, where to park, what to wear and who will meet them.",
        ],
      },
      {
        heading: "Remind them the day before",
        body: ["A short, friendly reminder the day before cuts no-shows more than anything else. Keep it practical: time, place, what to bring, and a name to ask for at the door."],
      },
      {
        heading: "Make the first class about them",
        body: [
          "- Greet them by name at the door.",
          "- Pair a new child with a friendly student of a similar age.",
          "- Give them one thing they can do well by the end of the class.",
          "- Speak to the parent before they leave, not after they've gone home.",
        ],
      },
      {
        heading: "Ask them to join on the day",
        body: [
          "If the class went well, ask. Have your sign-up link ready on a QR code by the door so the parent can join on their phone in a couple of minutes, with their membership and Direct Debit done in one go.",
          "Anyone who doesn't join on the night should hear from you within two days. After a week, most have moved on.",
        ],
      },
      {
        heading: "Track what happens",
        body: ["Keep a simple list: enquired, booked, came, joined. Once you can see where people drop off, you know what to fix. If lots book but don't come, work on reminders. If lots come but don't join, work on the first class."],
      },
      {
        heading: "In Junbi",
        body: ["Leads books the trial, sends the welcome and the reminder for you, and marks the lead as joined when the family signs up with your link. Your club website's free-trial form adds new leads by itself."],
      },
    ],
  },
  {
    slug: "setting-membership-prices",
    title: "Setting membership prices without losing members",
    summary: "Most clubs undercharge, then raise prices in a panic. A few simple rules make pricing calmer for you and for families.",
    minutes: 4,
    sections: [
      {
        heading: "Keep it simple",
        body: [
          "Two or three memberships is plenty: for example, one class a week, unlimited classes, and a family option. Every extra choice is a question parents have to ask you before they can join.",
          "Monthly Direct Debit works better than termly or pay-as-you-go. It smooths your income, families don't have to remember to pay, and it doesn't stop over the holidays when your rent doesn't either.",
        ],
      },
      {
        heading: "Price for what it costs to run",
        body: [
          "Work out your real monthly costs: venue, instructors, insurance, licences, equipment, software and your own time. Divide by the number of members you can realistically have. That's your floor, not your price.",
          "Then look at what other activities cost locally. Martial arts is often cheaper than swimming lessons or private football coaching, despite smaller classes and qualified instructors.",
        ],
      },
      {
        heading: "Use a sign-up fee",
        body: ["A one-off sign-up fee covers the time it takes to bring someone new in, and people value what they've paid to join. Many clubs include a first uniform or licence in it so it feels like good value rather than a charge."],
      },
      {
        heading: "Raising prices",
        body: [
          "- Raise a little each year rather than a lot every few years.",
          "- Give at least a month's notice and say why, plainly.",
          "- Consider keeping existing members on their price for a few months as a thank-you.",
          "- New prices for new members can start straight away.",
        ],
      },
      {
        heading: "In Junbi",
        body: ["Set your prices and sign-up fee in Settings. You can hide old prices from the sign-up form while existing members carry on paying them."],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
