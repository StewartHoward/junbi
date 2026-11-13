-- Discount codes: clubs make codes that take a percentage off membership fees. Families type one in when they
-- sign up with the club's link or QR code. The discount stays on that membership for as long as it runs.
CREATE TABLE IF NOT EXISTS "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"code" text NOT NULL CHECK ("code" ~ '^[A-Z0-9-]{3,30}$'),
	"percent" integer NOT NULL CHECK ("percent" BETWEEN 1 AND 100),
	-- Who or what it's for, for the club's own reference, e.g. "Staff children" or "Sarah Jones".
	"note" text,
	-- How many families can use it. Null = no limit. 1 = a one-off code for one family.
	"max_uses" integer CHECK ("max_uses" IS NULL OR "max_uses" > 0),
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_club_code" ON "discount_codes" ("club_id", "code");
--> statement-breakpoint
ALTER TABLE "discount_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "discount_codes";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "discount_codes" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "payment_setups" ADD COLUMN IF NOT EXISTS "discount_code_id" uuid REFERENCES "public"."discount_codes"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "payment_setups" ADD COLUMN IF NOT EXISTS "discount_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "discount_code_id" uuid REFERENCES "public"."discount_codes"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "discount_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON discount_codes FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON discount_codes TO junbi_app;
  END IF;
END $$;
