# Junbi product principles

Read this before building or changing any feature. When this and the developer brief disagree, this wins.

## Why Junbi exists
Most club systems are over-complicated and too expensive. Junbi wins by being the simple, fairly priced option for UK martial arts clubs.

## What Junbi is (and isn't, yet)
Back to basics. Junbi does four jobs:
1. **Class management:** students and families, sites, a weekly timetable.
2. **Attendance:** tap-to-mark registers on a phone.
3. **Direct Debit collection:** through each club's own GoCardless account.
4. **Communication:** email and text to a class, a site or everyone.

Plus **belts for every art**: each student's current belt in each art they train, recorded by staff. No gradings module, scoring or certificates yet.

Everything else waits until clubs ask for it.

## Who it's for
Small to mid-size UK martial arts clubs, often owner-run, with one or two sites and often under 150 students. Many teach more than one art. The owners usually aren't tech people.

## Martial arts at launch
Taekwondo, Karate, Kickboxing, Judo, Brazilian Jiu-Jitsu, Krav Maga, Muay Thai and MMA, all live from day one. A club picks one or more at set-up and gets each art's belt system ready to go (they can change it). Belt systems live in `src/lib/disciplines.ts`; adding an art is a data change, not a rebuild.

## What success looks like
- A club signs up and is taking money in an evening, without help.
- A register is taken on a phone in under 60 seconds.
- **Total Combat** (the test club) runs a full month's billing through Junbi.

## Rules for every feature
- **Simple beats complete.** If it makes the common job slower or busier, it waits.
- **Sensible defaults, few settings,** so owners edit rather than build from scratch.
- **Only build what clubs actually ask for,** starting with Total Combat.
- **Art-specific where it matters** (belt systems, wording) and generic everywhere else.
- **Flat price, 0% of fees, always. Every feature on every plan.**

## Build order
1. Email (password reset, staff invites, trial reminders)
2. Student import, with families and belts matched
3. GoCardless Direct Debit
4. Messages to parents (email and text)
5. Paying for Junbi at the end of the trial

## Hold back until clubs ask
Gradings (scoring, certificates, events), family app, kiosk, bookings, shop, association hub, competitions, accounting sync. Keep the data model ready for them, but don't build the screens yet.

## Risks to design around
- **Moving Direct Debit mandates is the biggest switching barrier,** so make import painless.
- **The market is small,** so keep running and support costs low.
- **Children's data and payments** need security and GDPR handled properly from the start.

## Pricing (live)
- **Starter** £19 a month: up to 50 active students, 1 site.
- **Club** £39 a month: up to 150 active students, 1 site.
- **Academy** £69 a month: unlimited students, up to 3 sites.
- **Association** from £149 a month: 5 clubs, then £15 per club. Set up with us.
- Every feature on every plan. Annual billing gets two months free. Prices exclude VAT.
- **Trial:** 14 days, plus one 14-day extension. Founding Clubs get 30 days, then 50% off for six months and their price locked for two years.
- The single source for plan data is `src/lib/plans.ts`.

## Website rules
- No mention of Total Taekwondo anywhere on Junbi's website.
- Don't name AllSorted as a system clubs can switch from.
