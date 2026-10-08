# Junbi: notes for Claude

Junbi is multi-tenant club management software for UK taekwondo schools. **Read `docs/principles.md` first**: it sets who Junbi is for, the build order and the rules every feature must follow, and it wins over the brief. Then read `docs/brief.md` for scope, roles, payments and phases, and `docs/tokens.json` for the design system. Approved designs are linked from the brief.

## Stack

Next.js 15 (App Router, server components), TypeScript, Drizzle ORM, PostgreSQL 16, Vitest.

## Rules that must not be broken

- **Tenant isolation.** Every club-owned table has `club_id`, is listed in `TENANT_TABLES` (`src/db/schema.ts`), and has a row-level security policy in a migration. App code reads and writes only through `withClub()` (`src/db/client.ts`). Never connect the app as a superuser or a role with BYPASSRLS.
- **Permissions.** Check `assertCan()` / `canAtSite()` from `src/auth/permissions.ts` before any read or write. Instructors and assistants must never see payment amounts or reasons, only `paymentNoticeFor()`.
- **Rank is derived** from the latest passing grading result. Never store a "current grade" on the student.
- **Money is in pence** (integers). Format with `formatPence()`.
- **Junbi never holds club money.** Each club connects its own Stripe account (Stripe Connect) for Direct Debit and cards. Stripe is the only payment provider.
- **Sign-in data** (`users.password_hash`, `auth_sessions`, `auth_failures`) is only touched through the SECURITY DEFINER functions in `drizzle/0007_auth_security.sql`. Never grant the app role direct access to those tables.
- **The seed wipes data** and only runs against localhost. Never point it at Supabase.

## Style

- UK English in all copy (colour, licence, programme). Plain, calm wording. No exclamation marks in UI, no em dashes in copy.
- Use the CSS variables in `src/app/globals.css` (from `docs/tokens.json`); don't hard-code new colours.
- Buttons are pills, cards are `radius-lg`, touch targets at least 44px, and pages must work at phone width.

## Before finishing any change

```bash
npm run typecheck && npm test && npm run build
```

Add tests for anything touching payments, permissions or tenant data.
