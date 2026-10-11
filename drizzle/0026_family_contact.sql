-- Home address and an emergency contact for each family.
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "address_line1" text;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "address_line2" text;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "town" text;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "postcode" text;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "emergency_name" text;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN IF NOT EXISTS "emergency_phone" text;
