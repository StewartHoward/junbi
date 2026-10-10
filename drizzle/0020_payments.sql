CREATE TABLE "club_payment_accounts" (
	"club_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token_enc" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_setups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"items" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "provider_customer_id" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "provider_subscription_id" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_payment_accounts" ADD CONSTRAINT "club_payment_accounts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_setups" ADD CONSTRAINT "payment_setups_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_setups" ADD CONSTRAINT "payment_setups_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;