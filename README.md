# Junbi

Club management software for UK taekwondo schools. *Your club, ready.*

This repository holds the Junbi admin web app. The full plan is in [`docs/brief.md`](docs/brief.md) and the brand tokens are in [`docs/tokens.json`](docs/tokens.json).

## What works so far (Phase 1, first slice)

- **Database schema** for clubs, sites, staff, households, guardians, students, the belt ladder, grading results, plans, memberships, Direct Debit mandates, payments, classes, sessions, attendance and an audit log.
- **Tenant isolation in the database.** Every table is protected by Postgres row-level security on `club_id`. The app connects as a role that cannot bypass it, so one club can never see another's data, even if a query forgets a `WHERE` clause. Tests prove it.
- **Roles and permissions** (owner, admin, instructor, assistant) from the brief's matrix, including site scoping. Instructors and assistants never see payment details, only "Please see the office".
- **Students list** with search, belt chip, status and flags.
- **Student profile** with belt journey, classes since last grading, ready-to-grade badge, family, membership, medical notes (staff only), grading history and household payments (owners and admins only).
- **Demo data** for one club with two sites.

## Not built yet

- **Real sign-in.** `/dev/login` lets you pick a demo user and is switched off in production. Email and password, magic links, Apple and Google sign-in and 2FA come next.
- GoCardless and Stripe connections (the tables are ready; no live payments are taken).
- Classes, registers, kiosk, gradings, messages, Family app, marketing site.

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
npm run db:seed                     # demo club
npm run dev                         # http://localhost:3000
```

Open `http://localhost:3000/dev/login` and sign in as the owner, an instructor or an assistant to see how each role differs.

## Online demo (Supabase + Vercel)

The demo runs on fake data only. Never use demo mode for a real club.

1. **Supabase:** create a project in the **London** region. Note the database password.
2. **GitHub secrets** (repo Settings › Secrets and variables › Actions):
   - `DEMO_DATABASE_ADMIN_URL`: Supabase's **Session pooler** connection string, with your database password filled in.
   - `JUNBI_APP_DB_PASSWORD`: a new password for the app's restricted login (8+ letters, digits, `_` or `-`).
3. **GitHub Actions:** run **Set up demo database**. It creates the tables, security rules, the restricted `junbi_app` login and the demo club.
4. **Vercel:** import this repo and set these environment variables:
   - `DATABASE_URL`: the Supabase **Transaction pooler** string, with the user changed from `postgres.<project-ref>` to `junbi_app.<project-ref>` and the password set to `JUNBI_APP_DB_PASSWORD`.
   - `DATABASE_ADMIN_URL`: the same value as the GitHub secret (only the demo sign-in page uses it).
   - `JUNBI_DEMO_MODE`: `1`
5. Deploy, then open `/dev/login` on your Vercel address.

## Tests

```bash
npm test          # permission matrix + tenant isolation against real Postgres
npm run typecheck
```

## How data access works

Always go through `withClub()` in `src/db/client.ts`. It opens a transaction and sets `app.club_id`, which the row-level security policies read. Check permissions with `assertCan()` from `src/auth/permissions.ts` before reading or writing anything.

New tables that belong to a club must have a `club_id` column, be added to `TENANT_TABLES` in `src/db/schema.ts`, and get a policy in a migration. The tenant isolation test fails if one is missed.
