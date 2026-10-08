# Junbi: Developer Brief

> Product principles, build order and live pricing are in `docs/principles.md`, which takes priority over this brief where they differ.

Oct 7, 2026 · Stewart Howard

## Summary

We need a quote to build **Junbi**, a multi-tenant SaaS for UK taekwondo clubs, in four phases over roughly 12 months. Phase 1 (student profiles, logins and roles, Direct Debit billing, classes and registers) must be live first, because Total Taekwondo (Southport and Preston) will run on it as the pilot.

**What Junbi is:** club management software built only for taekwondo. Clubs pay a flat monthly subscription: Essentials from £19, Pro from £35, Association from £149 (see `docs/principles.md` for the live price table). Junbi never handles club money: each club connects its own GoCardless and Stripe accounts.

**Five surfaces to build**

1. **Admin web app** for owners, admins and instructors (desktop first, responsive).
2. **Junbi Family**, the parent and student app (iOS and Android, plus mobile web).
3. **Junbi Kiosk**, an iPad check-in app for the dojang door.
4. **Marketing site** with pricing and self-serve sign-up.
5. **Platform admin** for the Junbi team: clubs, plans, billing, support access.

**Design references (approved)**

- [Brand and design system](https://claude.ai/artifact/NziJMSqG6CX6ASPoUNjPu2): colours, type, spacing, logo, voice. Tokens are also in `docs/tokens.json` in this repository.
- [Marketing site designs](https://claude.ai/artifact/EsspbgeCVkvDdrr7Ddej2X): homepage and pricing.
- [App screen designs](https://claude.ai/artifact/BXJGaVjhYcZiK7ug6RLYVJ): student profile, payments, Family app, kiosk, register, owner Today view.
- [Product spec and pricing](https://claude.ai/code/artifact/d426e4ea-82ed-4ada-8a51-732eece7eecd): features, plan tiers, competitor context.

These links are private to Stewart until shared.

## Users, roles and permissions

Permissions are enforced server-side on every request, scoped by club and by site. Staff see only the sites they are assigned to.

| Capability | Owner | Admin | Instructor | Assistant | Parent / student |
| --- | --- | --- | --- | --- | --- |
| Club settings, plan, subscription billing | ✓ |  |  |  |  |
| Add or remove staff | ✓ | ✓ |  |  |  |
| View and edit student profiles | ✓ | ✓ | Own classes |  | Own family |
| View medical notes | ✓ | ✓ | Own classes |  | Own family |
| View payment data and mandates | ✓ | ✓ |  |  | Own family |
| Create charges, refunds, plan changes | ✓ | ✓ |  |  |  |
| Take registers | ✓ | ✓ | ✓ | ✓ |  |
| Record grading scores, tick syllabus | ✓ | ✓ | ✓ |  |  |
| Message classes and families | ✓ | ✓ | ✓ |  |  |
| Reports and exports | ✓ | ✓ |  |  |  |
| Book classes, pay, sign forms |  |  |  |  | ✓ |

**Rules to build in**

- Instructors and assistants see a neutral "Please see the office" flag instead of any payment detail.
- Custom roles (Pro and Association plans) are built from the same permission list.
- Junbi platform staff can only enter a club's data through time-limited, logged support access granted by the club Owner.
- Every change to a payment, grade, medical note or permission is written to an audit log (who, what, when, before and after).

## Surfaces and screens

Screens marked **(designed)** have approved designs in the canvases linked above; the rest follow the same design system.

| Surface | Screens | Phase |
| --- | --- | --- |
| **Admin web app** | Today dashboard; Students list and filters; **Student profile (designed)** with Overview, Gradings, Payments, Attendance, Documents, Notes tabs; Households; Classes and timetable; Register; **Payments dashboard (designed)**; Membership plans; Staff and roles; Club settings; Import wizard | 1 |
|  | Gradings planner and examiner scoring; Syllabus editor; Trials and leads; Messages and templates | 2 |
|  | Shop and stock; Competitions; Reports; Multi-site dashboard; Exports (Xero, QuickBooks, FreeAgent) | 3 |
| **Junbi Family** | Sign-up and Direct Debit set-up; **Home (designed)**; Timetable and booking; Belt progress; Payments; Messages; Forms and consents | 1 (mobile web), 3 (native apps) |
| **Junbi Kiosk** | **Check-in grid (designed)**; Search; Trial check-in; Staff unlock | 2 |
| **Instructor mobile** | **Register (designed)**; **Owner Today (designed)**; Student quick view | 1 (responsive web) |
| **Marketing site** | **Home (designed)**; **Pricing (designed)**; Features; Sign-up and free trial (14 days, 30 for Founding Clubs); Legal pages | 1 |
| **Platform admin** | Clubs; Plans and subscriptions; Support access; Feature flags; Audit log | 1 |
| **Association hub** | Member clubs; Licence register; Shared gradings; Head-office reports | 4 |

## Data model

The **Student** is the record everything hangs off. It sits in a Household with Guardians, holds a Membership on a Plan, has Attendance at Sessions, and has Progress ticks and Grading results.

```
Association ──has clubs──▶ Club ──has sites──▶ Site
                            │
                  club_id on every record
     ┌──────────────┬───────┴──────┬──────────────────┐
  People          Billing        Classes           Progress
  - Household     - Plan         - Class           - Syllabus item
  - Guardian      - Membership   - Session         - Progress ticks
  - Student       - Mandate      - Booking         - Grading event
  - Staff/roles   - Payment      - Attendance      - Grading result
                  - Payout
```

**Key relationships**

- A Household has one or more Guardians and Students, and one Mandate that pays for every Membership in it. Family discounts are applied at Household level.
- A Membership links a Student to a Plan, with status (trial, active, paused, frozen, cancelled), start date and site.
- A Payment belongs to a Mandate (or a card) and to one or more charges: membership, grading fee, kit or licence. Payouts group Payments as GoCardless and Stripe report them.
- A Class runs at a Site, generates Sessions, and Sessions take Bookings and Attendance.
- A Student's current rank is derived from their latest passed Grading result, never typed in by hand. Rank history comes from those results.
- An Association links Clubs and owns shared Syllabi, Grading events and the licence register (Phase 4).
- Staff are Users with a Role per Club and Site; one person can be staff at one club and a guardian at another.

## Payments

Each club connects its own payment accounts, so money goes from family to club directly and Junbi is never a payment intermediary. Junbi's own subscription income from clubs is billed separately through Junbi's own Stripe account.

### GoCardless (Direct Debit, the main method)

Build as a [GoCardless partner integration](https://docs.gocardless.com/docs/partner-integrations/connect-your-merchants):

- **Connect:** the club Owner goes through GoCardless OAuth from Junbi's settings, signing up or logging in. Junbi exchanges the code server-side for an access token with `read_write` scope.
- **Store securely:** the access token (encrypted at rest; it gives full access to the club's GoCardless account) and the club's organisation ID, which routes webhooks.
- **Mandates:** set up inside Junbi's family sign-up flow, so a parent can join and authorise Direct Debit in one flow on their phone.
- **Subscriptions and one-off payments:** monthly or termly plans, family discounts and pro-rata first payments are calculated by Junbi. Grading fees, kit and licences are charged on the same mandate.
- **Webhooks (must handle):** mandate created, active, cancelled, failed or expired; payment confirmed, failed, charged back or paid out; payout paid; and organisation disconnected. A disconnect event can't be followed by API calls, so clean up from the webhook alone. Verify every webhook signature and process events idempotently.
- **Failed payments:** Junbi-side retry rules (a retry timed after payday, then a pay-now card link), plus parent emails and push notifications. Flag the student to Admins after 2 failed retries.
- **Partner revenue:** GoCardless lets partners add an app fee or take a share of GoCardless's fees. This is a commercial decision for Stewart, not a build blocker.

### Stripe (cards, Apple Pay, Google Pay)

- Used for families who can't or won't use Direct Debit, for the shop, and as the pay-now fallback after a failed Direct Debit.
- Build on Stripe Connect. Stripe now treats "Standard" accounts as a legacy type for new platforms and points new builds to its [Accounts v2 API](https://docs.stripe.com/connect/accounts-v2); [Standard accounts reference](https://docs.stripe.com/docs/connect/standard-accounts). Each club should keep full Stripe dashboard access and liability, using direct charges to the club's account.

### Junbi subscription billing

- Junbi's own Stripe Billing account handles the Essentials, Pro and Association plans: price set each month by active students, 14-day trial with no card (one 14-day extension; 30 days for Founding Clubs), monthly or annual, upgrades and downgrades pro-rata. Essentials is limited to one site.
- Going over a plan's student limit should prompt the Owner to upgrade, never lock the club out.
- Founding Club offer: 50% off for 6 months, price locked for 24 months (coupon and price-lock flag).

### Accounting and reconciliation

- Payouts screen matching each payout to the payments it contains.
- CSV export in Phase 1. Xero, QuickBooks and FreeAgent sync in Phase 3.

## Architecture and non-functional requirements

The stack below is a suggestion; developers may propose alternatives with reasons. What is fixed: one shared codebase, multi-tenant, UK-hosted.

| Area | Suggested |
| --- | --- |
| Web apps (admin, marketing, Family web) | TypeScript, React with Next.js |
| Mobile (Family, Kiosk) | React Native with Expo, sharing types and API client with web |
| API | TypeScript (Node) REST or tRPC, OpenAPI documented |
| Database | PostgreSQL with a `club_id` on every tenant table and row-level security |
| Jobs | Queue for webhooks, retries, emails and nightly tasks (for example at-risk detection) |
| Hosting | UK region (for example AWS London, eu-west-2), separate staging and production |
| Email, SMS, push | Transactional email provider, UK SMS provider, APNs and FCM push |
| Auth | Email and password, magic link, Sign in with Apple and Google; TOTP 2FA |

**Non-functional requirements**

- **Tenant isolation:** no query can return another club's data. Automated tests must prove this.
- **UK GDPR:** data stored in the UK, a data processing agreement on sign-up, a full club data export, deletion on request, retention rules, and consent records. Most members are children, so treat medical and contact data as high-risk.
- **Security:** encryption in transit and at rest, encrypted payment-provider tokens, 2FA for Owners and Admins, audit log, rate limiting, and an independent penetration test before public launch.
- **Reliability:** 99.9% uptime target, daily backups with point-in-time recovery, and a status page.
- **Performance:** admin pages load in under 2 seconds on 4G; kiosk check-in confirms in under 1 second.
- **Kiosk offline:** check-ins queue locally and sync when the connection returns.
- **Accessibility:** WCAG 2.2 AA across all surfaces.
- **Design fidelity:** build to the Junbi design system tokens (colour, type, spacing, radius); no third-party UI themes.

## Choose your art (club set-up)

Junbi launches for Taekwondo only, but the set-up flow and data model must be ready for more arts without a rebuild.

- **Set-up step:** when an owner creates their club, they pick "Which arts do you teach?" with one or more choices. At launch only Taekwondo is selectable; Karate, Kickboxing, Judo and Krav Maga show as "Coming soon" so clubs can register interest.
- **Discipline packs:** each art is a pack that sets the belt ladder, grading syllabus, competition types, licence body and wording (dojang, dojo, gym). Taekwondo is the first pack (kup, poom and dan; WT and ITF syllabus presets).
- **Dashboard follows the choice:** a single-art club sees no art switcher. A multi-art club gets a filter across the top (All, Taekwondo, Kickboxing...) on Today, Students, Classes and Gradings, and every class, grade and grading belongs to one art.
- **Students across arts:** one student profile and one Direct Debit, with a separate rank per art they train in.
- **Data model:** a `disciplines` reference list, a `club_disciplines` link table, and a `discipline` column on grades, classes and grading events. Rank stays derived from grading results, per discipline.
- **Changing later:** owners can add or remove an art in settings. Removing one hides it but never deletes grading history.
- **Accepted when:** a Taekwondo club completes set-up in under 15 minutes, and adding a second pack later needs no schema change to existing tables.

## Build phases and acceptance criteria

Please quote each phase separately. A phase is accepted when every criterion passes on staging with real Total Taekwondo data.

| Phase | Target | Scope | Accepted when |
| --- | --- | --- | --- |
| **1. Core** | Months 1 to 4 | Club sign-up, trial and "choose your art" set-up (Taekwondo pack); logins, roles, 2FA; student profiles and households; CSV import; classes, timetable and registers; GoCardless connect, mandates, plans and failed-payment handling; Family mobile web (join, pay, timetable); marketing site; platform admin | Total Taekwondo's two sites run a full month's billing through Junbi; 100% of members imported with families matched; an instructor takes a register on a phone in under 60 seconds; tenant isolation tests pass |
| **2. Taekwondo** | Months 5 to 7 | Syllabus presets and editor; grading readiness, events, fees, tablet scoring, PDF certificates; Junbi Kiosk (iPad); trials and lead follow-up; email, SMS and push messaging | A full grading is run end to end in Junbi; kiosk check-in works offline and syncs; a trial booked on the website gets automatic reminders |
| **3. Grow** | Months 8 to 10 | Native Family app (App Store and Google Play); Stripe cards and shop; competitions; reports; multi-site dashboard; accounting exports | Apps approved in both stores; parent can pay by card or Direct Debit; reports match the payments ledger to the penny |
| **4. Launch** | Months 11 to 12 | Association hub; migration tools for other systems; Founding Club offer; penetration test and fixes; public launch | Pen test has no high or critical findings open; 10 paying beta clubs live; a club can self-serve from sign-up to first Direct Debit in under 15 minutes |

**Ways of working we expect**

- Fortnightly demos on staging, with Stewart as product owner.
- Code in a repository owned by Junbi from day one, with handover documentation.
- Automated tests for payments, permissions and tenant isolation as a minimum.

## What we need in the quote

1. Fixed price or estimate range for each phase, with what drives the range.
2. Team: roles, seniority, location, and time per week on Junbi.
3. Timeline per phase and your earliest start date.
4. Stack you propose, and anything here you would change and why.
5. Monthly running costs at 10, 100 and 500 clubs (hosting, email, SMS, monitoring).
6. Support and maintenance after launch: monthly cost and response times.
7. Two examples of SaaS or payments work you've shipped, with references.
8. Confirmation that Junbi owns all code, designs and data.

## Open questions

- [ ] Commercial: will Junbi add a GoCardless partner app fee, or keep "0% of your fees" strictly? (Affects pricing claims, not the build.)
- [ ] Should the native Family app ship in Phase 1 instead of mobile web? (Faster adoption, higher Phase 1 cost.)
- [ ] Which association syllabi to preset first: WT only, or also ITF and the major UK associations?
- [ ] Which art pack comes second after Taekwondo: Kickboxing or Karate? (Both grade in a similar way; Total Combat could pilot Kickboxing.)
- [ ] Company set-up: Junbi as its own limited company, ICO registration and terms of service before the first outside club.
- [ ] Domain: secure thejunbi.com or junbiworks.com, and check junbi.co.uk and junbi.app.

## Sources

- [GoCardless: Connect your merchants](https://docs.gocardless.com/docs/partner-integrations/connect-your-merchants)
- [Stripe: Accounts v2 for Connect](https://docs.stripe.com/connect/accounts-v2)
- [Stripe: Standard connected accounts](https://docs.stripe.com/docs/connect/standard-accounts)
