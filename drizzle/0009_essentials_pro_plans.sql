ALTER TABLE "clubs" ALTER COLUMN "plan" SET DEFAULT 'essentials';--> statement-breakpoint
-- Move any clubs on the old size-based plans to Essentials / Pro.
UPDATE "clubs" SET "plan" = 'essentials' WHERE "plan" = 'starter';
--> statement-breakpoint
UPDATE "clubs" SET "plan" = 'pro' WHERE "plan" IN ('club', 'academy');
