-- A one-off sign-up fee per new member, set by the club and taken with the first payment.
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "signup_fee_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_setups" ADD COLUMN IF NOT EXISTS "signup_fee_pence" integer DEFAULT 0 NOT NULL;
