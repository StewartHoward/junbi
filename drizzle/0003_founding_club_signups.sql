CREATE TABLE "founding_club_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"active_students" text NOT NULL,
	"sites" integer DEFAULT 1 NOT NULL,
	"current_system" text,
	"plan" text,
	"consent_to_contact" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
