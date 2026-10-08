ALTER TYPE "public"."grade_kind" ADD VALUE 'kyu';--> statement-breakpoint
ALTER TYPE "public"."grade_kind" ADD VALUE 'grade';--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "plan" SET DEFAULT 'starter';--> statement-breakpoint
-- Back to the original size-based plans.
UPDATE "clubs" SET "plan" = 'starter' WHERE "plan" = 'essentials';
--> statement-breakpoint
UPDATE "clubs" SET "plan" = 'club' WHERE "plan" = 'pro';
