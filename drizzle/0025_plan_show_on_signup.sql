-- Prices can be kept for existing members but hidden from the sign-up form.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "show_on_signup" boolean DEFAULT true NOT NULL;
