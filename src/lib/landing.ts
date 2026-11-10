/*
 * Public landing pages on junbi.co.uk: one per feature (/features/...), the taekwondo page (/club-software/taekwondo)
 * and comparisons (/compare/...). Each is written for the search a club owner would actually make.
 * A paragraph starting with "- " is shown as a list item, as in the guides.
 * Competitor facts come from their own published pages, with the date they were checked. Keep them fair and current.
 */

export type LandingKind = "feature" | "art" | "compare";

export type Landing = {
  kind: LandingKind;
  slug: string;
  /** Short name for lists and links. */
  label: string;
  /** The <title> (Junbi is added after it). Aim for the search phrase. */
  metaTitle: string;
  /** Meta description, under 160 characters. */
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
  table?: { caption: string; head: string[]; rows: string[][]; note: string };
  faq: Array<{ q: string; a: string }>;
  /** Guide slugs to suggest at the foot of the page. */
  guides: string[];
  /** Other landing pages to suggest, as "kind/slug". */
  related: string[];
  share: { eyebrow: string; title: string; subtitle: string };
};

export const LANDINGS: Landing[] = [
  /* ---------- Features ---------- */
  {
    kind: "feature",
    slug: "direct-debit",
    label: "Direct Debit",
    metaTitle: "Direct Debit for Taekwondo Clubs",
    description: "Collect taekwondo membership fees by Direct Debit through your own Stripe or GoCardless account. One flat price, no percentage of your fees.",
    eyebrow: "Direct Debit",
    h1: "Membership fees, collected on time.",
    intro: "Parents set up Direct Debit on their phone when they join. The money goes from their bank to yours through your own Stripe or GoCardless account. Junbi never touches it and never takes a cut.",
    sections: [
      {
        heading: "Your account, your money",
        body: [
          "Some club systems collect your fees for you and pay you later, keeping a percentage on the way. Junbi works the other way round. You connect your own Stripe or GoCardless account and payments land in your bank on the provider's normal schedule.",
          "You pay Stripe or GoCardless their standard fee for each payment, and you pay Junbi one flat monthly price. That's it.",
        ],
      },
      {
        heading: "Set up as part of joining",
        body: [
          "- A new family picks their membership, fills in their details and sets up Direct Debit in one go, on their phone.",
          "- Brothers and sisters go on one Direct Debit for the whole family.",
          "- Sign-up fees can be taken with the first payment.",
          "- A student can't finish joining without choosing a membership, so nobody slips through unpaid.",
        ],
      },
      {
        heading: "See who's paid at a glance",
        body: [
          "The Payments page shows what's been collected this month, what's due and anything that failed. Failed payments are retried by the provider, and you can see the retry date.",
          "Instructors and assistants never see amounts. They only see a simple note if a student needs to speak to the office.",
        ],
      },
      {
        heading: "Already collecting through Stripe?",
        body: ["You don't need to ask families to sign up again. Junbi can take over existing Stripe Direct Debits on the date each one would next have charged, and stop the old schedule on the same day, so nobody is charged twice."],
      },
    ],
    faq: [
      { q: "Does Junbi take a percentage of our fees?", a: "No. Junbi is one flat monthly price from £19. Your payment provider charges its own standard fee per payment, and that's all." },
      { q: "Stripe or GoCardless: which should we use?", a: "Both work well for UK Direct Debit. If you already use one, connect that. If you're starting fresh, Stripe also handles card payments for gradings and your shop." },
      { q: "Can families pay by card instead?", a: "Memberships are collected by Direct Debit. One-off payments such as gradings, events and shop orders can be paid by card through your own Stripe." },
      { q: "What happens if a payment fails?", a: "Your provider retries it automatically and Junbi shows you the new date. You can send the family a fresh link to set up their Direct Debit again." },
    ],
    guides: ["switching-without-re-signing-families", "setting-membership-prices"],
    related: ["feature/trial-classes", "compare/nest", "feature/parent-login"],
    share: { eyebrow: "Direct Debit", title: "Membership fees, collected on time.", subtitle: "Through your own Stripe or GoCardless. One flat price, 0% of your fees." },
  },
  {
    kind: "feature",
    slug: "gradings",
    label: "Gradings",
    metaTitle: "Taekwondo Grading Software",
    description: "Run taekwondo gradings without the paperwork: see who's ready from attendance, take bookings and card payments online, and record results as new belts.",
    eyebrow: "Gradings",
    h1: "Gradings that almost run themselves.",
    intro: "Junbi works out who's ready from the register, invites families to book and pay online, and turns each pass into the student's new belt. No envelopes of cash, no spreadsheets the night before.",
    sections: [
      {
        heading: "Who's ready, from the register",
        body: [
          "Set how many classes each belt needs. When you create a grading, Junbi ticks every student who has trained enough since their last one. You can still add or remove anyone: the numbers are a starting point, not the final word.",
          "It works for kup and dan grades, poom grades, coloured belts and tags, whether you follow a WT, ITF or independent syllabus.",
        ],
      },
      {
        heading: "Booked and paid before the day",
        body: [
          "- Families get one invitation per family, so siblings are booked together.",
          "- They pay by card through your own Stripe when they book.",
          "- Set a place limit if your venue or examiner needs one.",
          "- You can see who's booked and paid at a glance.",
        ],
      },
      {
        heading: "Results become belts",
        body: ["Record results on the day or straight after. Each pass becomes the student's new grade in their record automatically, and their countdown to the next grading starts again from zero. Nobody types it in twice."],
      },
    ],
    faq: [
      { q: "Can we charge different prices for different grades?", a: "Yes. Set the price per grading, and run separate gradings for coloured belts and black belts if their fees differ." },
      { q: "Does it work with our association's syllabus?", a: "Yes. WT and ITF grades are ready to go, and you can rename, recolour or add grades and set the classes each one needs." },
      { q: "Can we run other events the same way?", a: "Yes. Dan gradings, seminars, competitions and holiday camps use the same booking and payment flow." },
    ],
    guides: ["gradings-that-run-themselves", "setting-membership-prices"],
    related: ["feature/registers", "art/taekwondo", "feature/parent-login"],
    share: { eyebrow: "Gradings", title: "Gradings that almost run themselves.", subtitle: "Who's ready from the register, bookings and payment online, results straight to belts." },
  },
  {
    kind: "feature",
    slug: "club-website",
    label: "Club website",
    metaTitle: "Taekwondo Club Website Builder",
    description: "A club website built into your club software: timetable, prices and free trial bookings that update themselves. Your own domain, included in every plan.",
    eyebrow: "Club website",
    h1: "A club website that keeps itself up to date.",
    intro: "Your timetable, prices and free trial form come straight from Junbi, so your website is never out of date. Add your photos, choose your sections and connect your own domain.",
    sections: [
      {
        heading: "Built from what's already in Junbi",
        body: [
          "Change a class time and it changes on your website. Add a new membership and it appears on your prices. Every free trial booking from the site lands in your Leads list, ready to follow up.",
          "You can also put your live timetable on a website you already have with a short piece of code, in your club's colours.",
        ],
      },
      {
        heading: "Edit it like a page, not a programme",
        body: [
          "- Add, remove and reorder sections: a big welcome photo, about the club, classes, prices, gallery, instructors, questions and a free trial form.",
          "- Upload your own photos. They're resized automatically so pages load fast on phones.",
          "- Preview changes before you publish them.",
        ],
      },
      {
        heading: "Your own domain",
        body: ["Use a free junbi.co.uk address, or point your own domain at Junbi so families see yourclub.co.uk. Each club website is set up to be found on Google, with its own title, description, local details and share image."],
      },
      {
        heading: "A shop too",
        body: ["Sell doboks, sparring kit and gift vouchers from the same site. Families pay by card through your own Stripe and you get an email for every order."],
      },
    ],
    faq: [
      { q: "Does the website cost extra?", a: "No. The website, your own domain and the shop are included in every plan." },
      { q: "Can we keep our current website?", a: "Yes. Copy the live timetable code from Settings into your existing site, and use your Junbi sign-up link for joining." },
      { q: "Will it show up on Google?", a: "Each published club site has its own title, description, local business details and share image, which helps Google show it for searches in your area." },
    ],
    guides: ["turning-trials-into-members"],
    related: ["feature/trial-classes", "feature/direct-debit", "art/taekwondo"],
    share: { eyebrow: "Club website", title: "A club website that keeps itself up to date.", subtitle: "Timetable, prices and free trial bookings straight from Junbi. Your own domain." },
  },
  {
    kind: "feature",
    slug: "trial-classes",
    label: "Trial classes",
    metaTitle: "Trial Class Booking for Taekwondo Clubs",
    description: "Book trial classes, send welcome and reminder emails automatically, and turn more trials into paying members. Built for UK taekwondo clubs.",
    eyebrow: "Trial classes",
    h1: "More trials. More of them joining.",
    intro: "Most clubs don't need more enquiries. They need more of the ones they get to turn up, enjoy it and join. Junbi books the trial, sends the reminders and makes joining a two-minute job on a parent's phone.",
    sections: [
      {
        heading: "Every enquiry in one list",
        body: ["Trial bookings from your club website and anyone you add by hand go into Leads. You can see who's booked, who came and who joined, so you know exactly where people drop off."],
      },
      {
        heading: "Welcome and reminder, sent for you",
        body: [
          "- A welcome email goes out as soon as the trial is booked, with the time, address and what to wear.",
          "- A reminder goes the day before, which cuts no-shows more than anything else.",
          "- Mark who came, and follow up quickly with anyone who didn't join on the night.",
        ],
      },
      {
        heading: "Join on the night",
        body: ["Put your sign-up link on a QR code by the door. A parent can choose a membership and set up Direct Debit in a couple of minutes, and the lead is marked as joined automatically."],
      },
    ],
    faq: [
      { q: "Can parents book a trial from our website?", a: "Yes. The free trial form on your Junbi club website books straight into Leads. You can also link to it from any other website." },
      { q: "Do you send text messages?", a: "Not yet. Welcome and reminder messages go by email for now." },
    ],
    guides: ["turning-trials-into-members", "marketing-a-taekwondo-club"],
    related: ["feature/club-website", "feature/direct-debit", "art/taekwondo"],
    share: { eyebrow: "Trial classes", title: "More trials. More of them joining.", subtitle: "Bookings, welcome emails and reminders sent for you. Join on the night." },
  },
  {
    kind: "feature",
    slug: "registers",
    label: "Registers and attendance",
    metaTitle: "Taekwondo Attendance and Class Registers",
    description: "Take taekwondo class registers on your phone in seconds. Attendance counts towards each student's next grading automatically, at every site.",
    eyebrow: "Registers",
    h1: "Registers in seconds.",
    intro: "Set up each weekly class once and Junbi gives you a register for it every week. Open today's class on your phone, tap students in, and every class counts towards their next belt.",
    sections: [
      {
        heading: "Made for the side of the dojang",
        body: [
          "- Large tap targets that work with one hand.",
          "- Belts shown next to each name so you can see the class at a glance.",
          "- Medical notes and emergency contacts one tap away for staff who are allowed to see them.",
        ],
      },
      {
        heading: "Attendance that does something",
        body: ["Every class marked counts towards the student's next grading. You can also spot students who've stopped coming before they cancel, and have a word while there's still time."],
      },
      {
        heading: "Every site, every instructor",
        body: ["Run more than one venue? Each site has its own timetable and registers. Give instructors their own logins and they'll only see the classes and students at their sites."],
      },
    ],
    faq: [
      { q: "Do instructors see payment details?", a: "No. Instructors and assistants never see amounts or reasons. They only see a short note if a student should speak to the office." },
      { q: "Is there an app to install?", a: "No. Junbi runs in the browser on any phone, tablet or computer, so there's nothing to install or update." },
    ],
    guides: ["gradings-that-run-themselves"],
    related: ["feature/gradings", "feature/parent-login", "art/taekwondo"],
    share: { eyebrow: "Registers", title: "Registers in seconds.", subtitle: "Tap students in on your phone. Every class counts towards their next belt." },
  },
  {
    kind: "feature",
    slug: "parent-login",
    label: "Parent login",
    metaTitle: "Parent and Member Login for Taekwondo Clubs",
    description: "Give parents and members their own login to update details, book gradings and events, and see payments and belts. Fewer messages to the office.",
    eyebrow: "Parent login",
    h1: "Families look after their own details.",
    intro: "Parents and adult members get their own login. They can keep contact and medical details up to date, book gradings and events, and see their payments and belts, without messaging you to ask.",
    sections: [
      {
        heading: "No passwords to forget",
        body: ["Families sign in with a link sent to their email. There's no password to remember or reset, and nothing to install."],
      },
      {
        heading: "What they can do",
        body: [
          "- Update addresses, phone numbers, emergency contacts and medical notes.",
          "- See every child in the family in one place.",
          "- Book and pay for gradings and events.",
          "- See their payments, Direct Debit status, belts and class times.",
        ],
      },
      {
        heading: "Less admin for you",
        body: ["Every detail a parent updates is one less message to the office, and your registers always have the right emergency contact."],
      },
    ],
    faq: [
      { q: "Can both parents have access?", a: "Yes. Any parent whose email address is on the family record can sign in with it." },
      { q: "Can they cancel their membership themselves?", a: "Cancellations come to you, so you have the chance to talk to the family first." },
    ],
    guides: ["switching-without-re-signing-families"],
    related: ["feature/direct-debit", "feature/gradings", "feature/registers"],
    share: { eyebrow: "Parent login", title: "Families look after their own details.", subtitle: "Contact details, gradings, events and payments, without messaging the office." },
  },

  /* ---------- Taekwondo ---------- */
  {
    kind: "art",
    slug: "taekwondo",
    label: "Taekwondo",
    metaTitle: "Taekwondo Club Management Software UK",
    description: "Club management software for UK taekwondo clubs: kup and dan grades, gradings, Direct Debit, registers and your club website. Flat price, 0% of your fees.",
    eyebrow: "Taekwondo",
    h1: "Software for taekwondo clubs.",
    intro: "Junbi was built inside a working taekwondo club, so kup and dan grades, gradings, squads and family memberships are there from day one. One flat price, and your fees stay yours.",
    sections: [
      {
        heading: "Kup and dan grades, ready to go",
        body: [
          "Pick taekwondo when you set up and Junbi loads the usual kup grades from 10th kup to 1st kup, then dan grades, with belt colours to match. Use tags or tips between grades? Add them. Your association's syllabus, your rules.",
          "Students' grades come from their grading results, so their record is always right and you can see their whole history.",
        ],
      },
      {
        heading: "Gradings every few months, without the admin",
        body: ["Most taekwondo clubs grade every two to three months. Junbi shows who has trained enough classes since their last grading, invites families to book and pay online, and turns every pass into a new belt."],
      },
      {
        heading: "Families, squads and more than one site",
        body: [
          "- Family memberships with brothers and sisters on one Direct Debit.",
          "- Separate classes for tiny tigers, juniors, adults, sparring squads and poomsae or patterns.",
          "- Each venue with its own timetable, registers and instructors.",
        ],
      },
      {
        heading: "Licences and association details",
        body: ["Whether you're with British Taekwondo, TAGB, an ITF group or an independent association, you can keep each student's licence number and expiry date on their record, ready to check before a grading or competition."],
      },
    ],
    faq: [
      { q: "Does Junbi work for ITF and WT clubs?", a: "Yes. You set the grades and the classes each one needs, so it works with WT, ITF and independent syllabuses." },
      { q: "Can we run poomsae and sparring squads as separate classes?", a: "Yes. Create as many weekly classes as you like at each site, each with its own register." },
      { q: "Can we track poom grades for juniors?", a: "Yes. The WT set-up includes poom grades for under-15 black belts, and you can add or rename grades to match your association." },
    ],
    guides: ["gradings-that-run-themselves", "how-to-start-a-taekwondo-club-uk", "setting-membership-prices"],
    related: ["feature/gradings", "feature/direct-debit", "feature/registers"],
    share: { eyebrow: "Taekwondo", title: "Software for taekwondo clubs.", subtitle: "Kup and dan grades, gradings, Direct Debit and your club website. Flat price, 0% of your fees." },
  },

  /* ---------- Comparisons ---------- */
  {
    kind: "compare",
    slug: "nest",
    label: "Junbi vs NEST",
    metaTitle: "NEST Alternative for Taekwondo Clubs",
    description: "Comparing Junbi and NEST for UK taekwondo clubs: how each charges, who holds your money and what's included. Based on NEST's published pricing.",
    eyebrow: "Compare",
    h1: "Junbi and NEST, side by side.",
    intro: "NEST is a long-established, full-service option for UK martial arts clubs, including taekwondo. Junbi is software only, at one flat price. Here's an honest comparison so you can decide which suits your club.",
    sections: [
      {
        heading: "How each one charges",
        body: [
          "NEST charges a percentage of the fees it collects for you. Its pricing page says fees run from 1.98% to 6%, starting at £50 a month, and publishes typical monthly fees by club size.",
          "Junbi is a flat monthly price from £19 to £149 depending on the size of your club. Stripe or GoCardless charge their own standard fee for each payment.",
        ],
      },
      {
        heading: "Who holds the money",
        body: [
          "NEST is an FCA-authorised payment institution and collects Direct Debits for clubs through its own service.",
          "With Junbi, payments go from the parent's bank to yours through your own Stripe or GoCardless account. Junbi never holds your money, and your Direct Debits stay with you if you ever leave.",
        ],
      },
      {
        heading: "What NEST offers that Junbi doesn't",
        body: [
          "To be fair to NEST, it offers things Junbi doesn't: a branded member app, text messages, marketing campaigns, business coaching and decades of experience with UK clubs. If you want a full-service partner, it's worth a look.",
        ],
      },
      {
        heading: "What Junbi offers",
        body: [
          "- Every feature on every plan: students and families, registers, gradings, Direct Debit, messages, parent login, a club website with your own domain and a shop.",
          "- A price that doesn't rise as your fees rise.",
          "- Set up in an evening. Already on Stripe? Junbi can take over your Direct Debits without families signing up again.",
        ],
      },
    ],
    table: {
      caption: "Monthly cost by club size",
      head: ["Club size", "Junbi", "NEST (typical, as published)"],
      rows: [
        ["Up to 50 students", "£19", "£77.94 (25 to 50 students)"],
        ["100 students", "£39", "£197.64"],
        ["200 students", "£69 (up to 3 sites)", "£392.05"],
      ],
      note: "From nestmanagement.co.uk/pricing, checked November 2026. NEST's figures are the typical monthly fees it publishes for clubs of that size; your own quote may differ.",
    },
    faq: [
      { q: "Can we move from NEST without families signing up again?", a: "If your Direct Debits are held by NEST rather than in your own account, families will need to set up a new Direct Debit with your Stripe or GoCardless. Junbi makes that a short link on their phone." },
      { q: "Is Junbi cheaper than NEST?", a: "For most clubs, yes, because Junbi doesn't charge a percentage. Compare NEST's published figures above with your own club size." },
    ],
    guides: ["switching-without-re-signing-families", "setting-membership-prices"],
    related: ["compare/martialytics", "feature/direct-debit", "compare/spreadsheets"],
    share: { eyebrow: "Compare", title: "Junbi and NEST, side by side.", subtitle: "How each charges, who holds your money and what's included." },
  },
  {
    kind: "compare",
    slug: "martialytics",
    label: "Junbi vs Martialytics",
    metaTitle: "Martialytics Alternative for UK Clubs",
    description: "Comparing Junbi and Martialytics for UK taekwondo clubs: pricing in pounds or dollars, UK Direct Debit, and what each plan includes.",
    eyebrow: "Compare",
    h1: "Junbi and Martialytics, side by side.",
    intro: "Both charge a flat price with every feature on every plan, and neither takes a cut of your fees. The differences are in price, currency and how UK payments work.",
    sections: [
      {
        heading: "Pricing",
        body: [
          "Martialytics publishes its prices in US dollars, from $69 a month for up to 50 active students to $199 a month for 200 or more. It includes a 30-day free trial.",
          "Junbi is priced in pounds, from £19 a month for up to 50 active students to £69 for unlimited students across up to three sites.",
        ],
      },
      {
        heading: "Payments",
        body: [
          "Martialytics takes payments through Stripe at Stripe's standard rates.",
          "Junbi works with either Stripe or GoCardless, so clubs that already collect through GoCardless can keep it. Both are set up for UK Direct Debit, and the money goes straight to your bank.",
        ],
      },
      {
        heading: "What Martialytics offers that Junbi doesn't",
        body: ["Martialytics includes a student app and has been running for years with clubs around the world. If a dedicated app matters most to you, that's a point in its favour."],
      },
      {
        heading: "What Junbi offers",
        body: [
          "- Made in the UK for UK clubs, with UK English, pounds and Direct Debit throughout.",
          "- A club website with your own domain, live timetable and a shop, included.",
          "- A parent login in the browser, with nothing to install.",
        ],
      },
    ],
    table: {
      caption: "Monthly price by club size",
      head: ["Active students", "Junbi", "Martialytics"],
      rows: [
        ["Up to 50", "£19", "$69"],
        ["51 to 100", "£39", "$99"],
        ["101 to 150", "£39", "$129"],
        ["151 to 200", "£69", "$129"],
        ["200+", "£69", "$199"],
      ],
      note: "From martialytics.com/pricing, checked November 2026. Martialytics prices are in US dollars. Junbi prices are in pounds.",
    },
    faq: [
      { q: "Can we use GoCardless with Junbi?", a: "Yes. Connect your own Stripe or GoCardless account." },
      { q: "Is there a free trial?", a: "Yes. Add your card when you sign up and you won't be charged for 7 days. Cancel before then and you pay nothing." },
    ],
    guides: ["switching-without-re-signing-families"],
    related: ["compare/nest", "feature/club-website", "compare/spreadsheets"],
    share: { eyebrow: "Compare", title: "Junbi and Martialytics, side by side.", subtitle: "Pounds or dollars, Stripe or GoCardless, and what each plan includes." },
  },
  {
    kind: "compare",
    slug: "spreadsheets",
    label: "Junbi vs spreadsheets",
    metaTitle: "Moving Your Taekwondo Club Off Spreadsheets",
    description: "Still running your taekwondo club on spreadsheets, paper registers and cash? Here's what changes when you move to club software, and what it costs.",
    eyebrow: "Compare",
    h1: "Spreadsheets got you this far.",
    intro: "Plenty of good clubs run on a spreadsheet, a paper register and a tin of cash. It works until it doesn't: a lost register, a missed payment, a parent's number out of date on the night you need it.",
    sections: [
      {
        heading: "What a spreadsheet can't do",
        body: [
          "- Collect fees by Direct Debit and tell you who hasn't paid.",
          "- Let parents update their own details.",
          "- Count classes towards the next grading as you take the register.",
          "- Take trial bookings from your website and send reminders.",
          "- Stop working the moment the one person who understands it goes on holiday.",
        ],
      },
      {
        heading: "What moving looks like",
        body: [
          "Export your spreadsheet as a CSV and import it into Junbi. Students, families and belts come across in one go. Then send families your sign-up link to set up Direct Debit.",
        ],
      },
      {
        heading: "What it costs",
        body: ["Junbi is £19 a month for a club with up to 50 active students. Collecting fees by Direct Debit instead of cash and bank transfers usually pays for that many times over in payments you'd otherwise chase."],
      },
    ],
    faq: [
      { q: "Will we lose our records?", a: "No. Import your spreadsheet and keep the original as a backup. Nothing in it is changed." },
      { q: "Is it hard to learn?", a: "Most clubs are set up in an evening. If you can use a spreadsheet, you can use Junbi." },
    ],
    guides: ["how-to-start-a-taekwondo-club-uk", "setting-membership-prices"],
    related: ["feature/direct-debit", "feature/registers", "compare/nest"],
    share: { eyebrow: "Compare", title: "Spreadsheets got you this far.", subtitle: "What changes when your club moves to proper club software, and what it costs." },
  },
];

export const KIND_PATH: Record<LandingKind, string> = { feature: "/features", art: "/club-software", compare: "/compare" };

export const landingsOf = (kind: LandingKind) => LANDINGS.filter((l) => l.kind === kind);
export const landingBy = (kind: LandingKind, slug: string) => LANDINGS.find((l) => l.kind === kind && l.slug === slug) ?? null;
export const landingPath = (l: Pick<Landing, "kind" | "slug">) => `${KIND_PATH[l.kind]}/${l.slug}`;
export const landingRef = (ref: string) => {
  const [kind, slug] = ref.split("/") as [LandingKind, string];
  return landingBy(kind, slug);
};

/** Index pages: /features, /club-software, /compare. */
export const INDEX: Record<LandingKind, { metaTitle: string; description: string; eyebrow: string; h1: string; intro: string; share: { eyebrow: string; title: string; subtitle: string } }> = {
  feature: {
    metaTitle: "Features",
    description: "Everything in Junbi: Direct Debit, gradings, registers, trial bookings, parent login and a club website. Every feature on every plan.",
    eyebrow: "Features",
    h1: "Everything your club runs on.",
    intro: "Every feature is included on every plan. Pick one to see how it works.",
    share: { eyebrow: "Features", title: "Everything your club runs on.", subtitle: "Direct Debit, gradings, registers, trials, parent login and a club website. Every plan." },
  },
  art: {
    metaTitle: "Taekwondo Club Software",
    description: "Club management software made for UK taekwondo clubs: kup and dan grades, gradings, Direct Debit and registers.",
    eyebrow: "Taekwondo",
    h1: "Made for taekwondo.",
    intro: "Kup and dan grades, gradings, squads and family memberships, built in from day one.",
    share: { eyebrow: "Taekwondo", title: "Made for taekwondo.", subtitle: "Kup and dan grades, gradings, Direct Debit and registers. One flat price." },
  },
  compare: {
    metaTitle: "Compare Taekwondo Club Software",
    description: "Honest comparisons of Junbi with NEST, Martialytics and spreadsheets for UK taekwondo clubs, based on each provider's published pricing.",
    eyebrow: "Compare",
    h1: "How Junbi compares.",
    intro: "Honest comparisons based on each provider's own published pricing, with the date we checked. If something has changed, tell us and we'll update it.",
    share: { eyebrow: "Compare", title: "How Junbi compares.", subtitle: "NEST, Martialytics and spreadsheets, based on published pricing." },
  },
};
