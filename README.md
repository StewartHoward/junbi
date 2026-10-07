# Junbi

Club management software for UK taekwondo schools. *Your club, ready.*

This repository holds the Junbi admin web app. The full plan is in [`docs/brief.md`](docs/brief.md) and the brand tokens are in [`docs/tokens.json`](docs/tokens.json).

## What works now

- **Club sign-up and sign-in.** A club owner signs up (30-day free trial, Founding Club offer), then signs in with email and password. Passwords are hashed with scrypt, sessions are random tokens stored only as hashes, and repeated wrong passwords lock the email for 15 minutes.
- **Club set-up with "choose your art".** Pick the arts you teach (Taekwondo now; Kickboxing, Karate, Judo and Krav Maga can be ticked as "tell me when ready"), add the first site and load a WT or ITF belt ladder.
- **Today:** greeting, trial status, today's classes with check-in counts, and a getting-started list.
- **Students:** search, add (with a family contact and starting belt), add a sibling to the same family, edit, and the full profile.
- **Classes and registers:** weekly timetable, add or remove classes, and a tap-to-mark register for any week.
- **Settings:** club name, arts, sites and staff list.
- **Tenant isolation in the database.** Every club table is protected by Postgres row-level security on `club_id`, and the app connects as a role that cannot bypass it. Sign-in data is only reachable through narrow database functions. Tests prove both.
- **Roles and permissions** (owner, admin, instructor, assistant) with site scoping.
- **Marketing site:** homepage, pricing and Founding Clubs, all leading to sign-up.

## Not built yet

- Password reset by email and staff invitations (both need an email service such as Resend or Postmark).
- GoCardless and Stripe connections (the tables are ready; no live payments are taken).
- Gradings, kiosk, messages, reports and the Family app.

## Run it locally

You need Node 22 and PostgreSQL 16.

```bash
npm install
cp .env.example .env.local          # then edit if your Postgres differs

# create the databases (once)
createuser -s junbi && psql -c "alter role junbi password 'junbi'"
createdb -O junbi junbi
createdb -O junbi junbi_test

set -a && . ./.env.local && set +a
npm run db:migrate                  # creates tables, RLS and the junbi_app role
npm run db:seed                     # optional sample club, local only
npm run dev                         # http://localhost:3000
```

Sign up at `/signup`, or sign in as one of the sample staff the seed prints.

## Hosting (Supabase + Netlify)

- **Database:** Supabase, London region. Apply each new file in `drizzle/` in order (Supabase SQL editor, or `npm run db:migrate` with `DATABASE_ADMIN_URL` set to the session pooler string).
- **App:** Netlify, deploying from `main`. It needs one environment variable, `DATABASE_URL`: the Supabase transaction pooler string using the restricted `junbi_app` login.

## Tests

```bash
npm test          # permissions, sign-in, set-up, registers and tenant isolation against real Postgres
npm run typecheck
```

## How data access works

Always go through `withClub()` in `src/db/client.ts`. It opens a transaction and sets `app.club_id`, which the row-level security policies read. Check permissions with `assertCan()` from `src/auth/permissions.ts` before reading or writing anything.

New tables that belong to a club must have a `club_id` column, be added to `TENANT_TABLES` in `src/db/schema.ts`, and get a policy in a migration. The tenant isolation test fails if one is missed.
