/*
 * Guides for club owners on junbi.co.uk/guides: practical, plain-English help with running and growing a club.
 * Each guide is sections of paragraphs; a paragraph starting with "- " is shown as a list item.
 */

export type Guide = { slug: string; title: string; summary: string; minutes: number; tags: string[]; sections: Array<{ heading: string; body: string[] }> };

export const GUIDES: Guide[] = [
  {
    slug: "switching-without-re-signing-families",
    title: "Switching club software without asking families to sign up again",
    summary: "The biggest worry about changing system is the Direct Debits. Here's how to move them across quietly, with no gap and no double charges.",
    minutes: 5,
    tags: ["payments", "switching"],
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
    tags: ["gradings", "running"],
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
    tags: ["growth", "marketing"],
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
    tags: ["payments", "running", "starting"],
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
  {
    slug: "how-to-start-a-martial-arts-club-uk",
    title: "How to start a martial arts club in the UK",
    summary: "Everything to sort before your first class: qualifications, insurance, checks, a venue, prices and your first students, in the order you'll need them.",
    minutes: 9,
    tags: ["starting", "running", "safeguarding", "payments", "marketing"],
    sections: [
      {
        heading: "Start with your qualification and association",
        body: [
          "Most clubs in the UK sit under an association or governing body for their art. Joining one usually gives you an instructor qualification, a grading syllabus, insurance options and a licence scheme for your students. It also reassures parents, venues and schools that you're doing things properly.",
          "If you're already an instructor with your association, ask what they need from a new club: often a minimum grade, a coaching award, a first aid certificate and a background check. If you're going independent, you'll need to arrange each of those yourself.",
        ],
      },
      {
        heading: "Get your checks and first aid sorted",
        body: [
          "- A criminal record check if you'll teach children or vulnerable adults: an enhanced DBS check in England and Wales, a PVG check in Scotland, or an AccessNI check in Northern Ireland. Your association can often arrange it.",
          "- A first aid qualification. Most associations and venues expect at least one qualified first aider at every class.",
          "- Safeguarding training, and a written safeguarding policy for the club. See our guide to writing one.",
        ],
      },
      {
        heading: "Insurance",
        body: [
          "You'll need public liability insurance as a minimum, and instructor or professional indemnity cover is strongly recommended. If you employ anyone, employers' liability insurance is a legal requirement. Many associations include cover with membership, so check what you already have before buying more.",
        ],
      },
      {
        heading: "Find a venue",
        body: [
          "Most new clubs start in a hired hall: a community centre, school sports hall or leisure centre. Check the floor, whether you can store mats, how much notice they need to cancel your booking, and whether their insurance covers your activity.",
          "Start with one or two classes a week at times that suit families, usually straight after school for juniors and early evening for adults. You can add more once they fill.",
        ],
      },
      {
        heading: "Set your prices",
        body: [
          "Work out your monthly costs (hall hire, insurance, association fees, kit, software) and divide by a realistic number of students for your first year. That's your floor. Then look at what local activities charge. Monthly Direct Debit is far easier to run than pay on the night, and it doesn't dip over the holidays.",
          "A sign-up fee that includes a first uniform or licence helps cover the cost of bringing someone new in.",
        ],
      },
      {
        heading: "The admin you'll need from day one",
        body: [
          "- A joining form with emergency contacts, medical notes and photo consent.",
          "- A register for every class, kept for your records and in case of an accident.",
          "- A way to collect fees and see who hasn't paid.",
          "- Clear membership terms: notice period, price changes, what happens over holidays.",
          "- Your data looked after properly under UK GDPR, and a check on whether you need to pay the ICO's data protection fee.",
        ],
      },
      {
        heading: "Find your first students",
        body: [
          "Set up a free Google Business Profile with your venue address and class times, and ask your first families for reviews. Offer a free trial class with a real date and time, run a taster session at a local school or fun day, and post short videos of classes on the social channels local parents use.",
          "Your first twenty students usually come from people who know you. The next hundred come from those twenty telling their friends, so make the first few months a great experience.",
        ],
      },
      {
        heading: "In Junbi",
        body: ["Junbi gives a new club the joining form, Direct Debit, registers, gradings and a club website with free trial booking from £19 a month. Set it up in an evening and send your sign-up link to your first families."],
      },
    ],
  },
  {
    slug: "martial-arts-club-insurance",
    title: "Insurance for martial arts clubs: what you actually need",
    summary: "Public liability, instructor cover, employers' liability and the rest, in plain English, so you know what you're covered for and what you're not.",
    minutes: 5,
    tags: ["starting", "running"],
    sections: [
      {
        heading: "Public liability",
        body: [
          "Public liability covers claims from members of the public, including students and parents, if they're injured or their property is damaged because of your club. Almost every venue will ask to see it before they let you hire the hall.",
          "Check the level of cover your venue requires, and whether the policy covers the arts you actually teach, including any sparring or contact.",
        ],
      },
      {
        heading: "Instructor or professional indemnity",
        body: ["This covers claims that your teaching itself caused an injury or loss: a technique taught badly, poor supervision, the wrong advice. In a contact sport it's just as important as public liability, and it's often included in association instructor membership."],
      },
      {
        heading: "Employers' liability",
        body: [
          "If you employ anyone, even part-time coaches, employers' liability insurance is a legal requirement in the UK, with some exceptions such as close family members. It covers claims from staff injured at work.",
          "Volunteers aren't employees, but check your policy covers them too.",
        ],
      },
      {
        heading: "Student personal accident cover",
        body: ["Many associations include personal accident cover in each student's licence. It pays out for injuries whether or not anyone was at fault. Make sure your students' licences are up to date, especially before gradings and competitions."],
      },
      {
        heading: "Other cover worth considering",
        body: [
          "- Equipment cover for mats, pads and bags, particularly if you store them at the venue.",
          "- Business interruption if you run your own premises.",
          "- Cyber and data cover if you hold a lot of members' personal data.",
        ],
      },
      {
        heading: "Questions to ask before you buy",
        body: [
          "- Does it cover every art and age group I teach, including sparring?",
          "- Does it cover me at every venue, at gradings, competitions and outdoor events?",
          "- Are assistant instructors and volunteers covered?",
          "- What's already included in my association membership?",
        ],
      },
      {
        heading: "In Junbi",
        body: ["Keep each student's licence number and expiry date on their record, so you can check licences before a grading or competition."],
      },
    ],
  },
  {
    slug: "safeguarding-policy-martial-arts-club",
    title: "Writing a safeguarding policy for your martial arts club",
    summary: "What a club safeguarding policy should cover, who does what, and how to make it something you actually use rather than a document in a drawer.",
    minutes: 6,
    tags: ["safeguarding", "starting", "running"],
    sections: [
      {
        heading: "Why every club needs one",
        body: [
          "If you teach children or adults at risk, you need a written safeguarding policy. Associations, venues, schools and insurers will ask for it, and parents increasingly look for it. More importantly, it means everyone at the club knows what to do if they're worried about someone.",
          "Your association may have a template policy. Start from that if it does, and make it fit your club.",
        ],
      },
      {
        heading: "What to include",
        body: [
          "- A clear statement that the welfare of children and adults at risk comes first.",
          "- The name and contact details of your club welfare or safeguarding officer.",
          "- Who needs a criminal record check, and how often they're renewed.",
          "- Codes of conduct for instructors, volunteers, students and parents.",
          "- How to report a concern, inside the club and to the local authority or police if needed.",
          "- Rules on physical contact during teaching, changing rooms and one-to-one sessions.",
          "- Photography, filming and social media, including consent.",
          "- Safe recruitment of instructors and volunteers.",
          "- How and when the policy is reviewed, usually every year.",
        ],
      },
      {
        heading: "Appoint a welfare officer",
        body: ["Choose someone approachable who isn't the head instructor if you can, so students and parents have someone independent to talk to. Make sure they're trained, and put their name and contact details on your noticeboard and website."],
      },
      {
        heading: "Make it part of how you run",
        body: [
          "- Keep emergency contacts and medical notes up to date for every student.",
          "- Record photo consent when families join, and check it before posting.",
          "- Take a register at every class, so you always know who was there.",
          "- Talk through the policy with every new instructor and volunteer.",
        ],
      },
      {
        heading: "Where to get help",
        body: ["The NSPCC's Child Protection in Sport Unit has free guidance, templates and training for sports clubs. Your association's safeguarding lead is also a good first call. If a child is in immediate danger, call 999."],
      },
      {
        heading: "In Junbi",
        body: ["Junbi keeps emergency contacts, medical notes and photo consent on every student, takes a register at every class, and lets parents keep their own details up to date. Instructors only see what they need."],
      },
    ],
  },
  {
    slug: "marketing-a-martial-arts-club",
    title: "Marketing a martial arts club on a small budget",
    summary: "The few things that actually bring new students through the door, from your Google listing to school tasters, and what to stop wasting money on.",
    minutes: 6,
    tags: ["marketing", "growth"],
    sections: [
      {
        heading: "Get found on Google first",
        body: [
          "When a parent searches for classes near them, the map results come first. A free Google Business Profile with your venue address, class times, photos and a link to book a free trial is the single best thing most clubs can do.",
          "Ask happy families for a review after their child's first grading. A steady trickle of honest reviews matters more than a big batch once a year.",
        ],
      },
      {
        heading: "Make booking a trial easy",
        body: ["Every advert, post and leaflet should point to one place to book a free trial with a real date and time. \"Come along whenever\" loses people. A booking with a reminder the day before turns interest into a visit."],
      },
      {
        heading: "Go where families already are",
        body: [
          "- Taster sessions at local primary schools, Scout and Brownie groups and holiday clubs.",
          "- A stand at school fairs and community fun days, with a sign-up QR code.",
          "- Holiday camps in the school breaks, open to non-members.",
          "- Local parents' groups on social media, where a recommendation from a member goes a long way.",
        ],
      },
      {
        heading: "Use what happens at the club",
        body: ["Gradings, competitions and belt presentations are your best content. Short clips and photos, with parents' consent, show what classes are really like better than any advert."],
      },
      {
        heading: "Reward referrals",
        body: ["Most new members come from existing ones. A small thank-you, such as a free month or a piece of kit, for every friend who joins keeps that going."],
      },
      {
        heading: "Watch the numbers",
        body: ["Track where each enquiry came from, how many book a trial, how many come and how many join. Stop spending on anything that doesn't bring trials, and do more of what does."],
      },
      {
        heading: "In Junbi",
        body: ["Your Junbi club website takes free trial bookings, sends the welcome and reminder for you, and shows you every lead from enquiry to joining."],
      },
    ],
  },
  {
    slug: "martial-arts-membership-terms",
    title: "Membership terms for martial arts clubs: what to include",
    summary: "Clear terms prevent most arguments with parents. Here's what a club's membership terms should cover, written fairly and in plain English.",
    minutes: 5,
    tags: ["payments", "running", "starting"],
    sections: [
      {
        heading: "Keep them short and fair",
        body: [
          "Your terms should be easy to read on a phone in a couple of minutes. Terms with consumers need to be fair and transparent under UK consumer law, so a term that's hidden, one-sided or hard to understand may not hold up anyway.",
          "This guide covers what to include. It isn't legal advice: if you're unsure, ask your association or a solicitor.",
        ],
      },
      {
        heading: "What to cover",
        body: [
          "- What the membership includes: which classes, how many a week, and at which sites.",
          "- The price, when it's collected and how payment works.",
          "- Any sign-up fee and what it includes.",
          "- How much notice is needed to cancel, and how to give it.",
          "- Whether members can pause, for example for injury, and for how long.",
          "- What happens with fees over school holidays and when the club closes.",
          "- How much notice you'll give before a price change.",
          "- Grading, licence and kit costs that aren't included.",
          "- Behaviour, safety and safeguarding expectations.",
          "- Photo and video consent.",
        ],
      },
      {
        heading: "Direct Debit",
        body: ["If you collect by Direct Debit, families are protected by the Direct Debit Guarantee, which lets them get a refund from their bank if a payment is taken in error. Tell families the amount and date before the first payment and before any change."],
      },
      {
        heading: "Ask them to agree when they join",
        body: ["Show the terms during sign-up and ask families to tick to agree, so there's a clear record. Keep old versions so you know which terms each family agreed to."],
      },
      {
        heading: "In Junbi",
        body: ["Families agree to your club's terms as part of joining online, choose their membership and set up Direct Debit in one go."],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;

/** Guides that share the most tags with this one, best match first. */
export function relatedGuides(g: Guide, n = 3): Guide[] {
  return GUIDES.filter((x) => x.slug !== g.slug)
    .map((x, i) => ({ x, score: x.tags.filter((t) => g.tags.includes(t)).length * 10 - i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((r) => r.x);
}
