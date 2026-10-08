# Junbi product principles

Read this before building or changing any feature. When this and the developer brief disagree, this wins.

## Why Junbi exists
Most club systems are over-complicated and too expensive. Junbi wins by being the simple, fairly priced option for UK taekwondo clubs.

## Who it's for
Small to mid-size UK clubs, often owner-run, with one or two sites and often under 150 students. The owners usually aren't tech people.

## What success looks like
- A club signs up and is taking money in an evening, without help.
- A register is taken on a phone in under 60 seconds.
- Total Taekwondo runs a full month's billing through Junbi.

## Rules for every feature
- **Simple beats complete.** If it makes the common job slower or busier, it waits or goes into Pro.
- **Keep Essentials genuinely simple.**
- **Sensible defaults, few settings,** so owners edit rather than build from scratch.
- **Only build what clubs actually ask for,** starting with Total Taekwondo.
- **Taekwondo-specific where it matters** (kup and dan, gradings, licences) and generic everywhere else.
- **Flat price, 0% of fees, always.**

## Build order
1. Email (password reset, staff invites, trial reminders, messages to parents)
2. Student import, with families matched
3. GoCardless Direct Debit
4. Plan gating (Essentials / Pro)
5. Gradings

## Hold back until clubs ask
Association hub, competitions, shop, kiosk, native apps, accounting sync and extra arts. Keep the data model ready for them, but don't build the screens yet.

## Risks to design around
- **Moving Direct Debit mandates is the biggest switching barrier,** so make import painless.
- **The market is small,** so keep running and support costs low.
- **Children's data and payments** need security and GDPR handled properly from the start.

## Pricing (live)
- **Essentials:** £19 / £29 / £39 / £59 a month by active students (up to 50 / 150 / 300 / 300+). One site.
- **Pro:** £35 / £49 / £69 / £99. Unlimited sites.
- **Association:** from £149 a month.
- Annual billing gets two months free. Prices exclude VAT.
- **Trial:** 14 days with everything in Pro, plus one 14-day extension. Founding Clubs get 30 days, then 50% off for six months and their price locked for two years.
- The single source for plan data is `src/lib/plans.ts`.
