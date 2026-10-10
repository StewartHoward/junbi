CREATE TABLE "promo_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"percent_off" integer NOT NULL,
	"months" integer,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "discount_months" integer;