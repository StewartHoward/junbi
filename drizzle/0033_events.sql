-- Gradings and events: the club sets one up, invites families, they book (and pay by card when the club
-- takes card payments), and for gradings the results become belts.
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"kind" text NOT NULL CHECK ("kind" IN ('grading', 'event')),
	"title" text NOT NULL,
	"discipline" text,
	"site_id" uuid REFERENCES "public"."sites"("id") ON DELETE set null,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"fee_pence" integer DEFAULT 0 NOT NULL CHECK ("fee_pence" >= 0),
	"capacity" integer CHECK ("capacity" IS NULL OR "capacity" > 0),
	"examiner" text,
	"notes" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"event_id" uuid NOT NULL REFERENCES "public"."events"("id") ON DELETE cascade,
	"student_id" uuid NOT NULL REFERENCES "public"."students"("id") ON DELETE cascade,
	-- Gradings: the belt they're going for.
	"grade_id" uuid REFERENCES "public"."grades"("id") ON DELETE set null,
	-- invited, pending (paying now), booked (confirmed, nothing to pay online), paid, declined, cancelled
	"status" text DEFAULT 'invited' NOT NULL CHECK ("status" IN ('invited', 'pending', 'booked', 'paid', 'declined', 'cancelled')),
	"amount_pence" integer DEFAULT 0 NOT NULL,
	"checkout_ref" text,
	-- When they went to the card page. A place held this way is released if they don't pay within the hour.
	"pending_since" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"outcome" "grading_outcome",
	"grading_result_id" uuid REFERENCES "public"."grading_results"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_bookings_event_student_key" UNIQUE ("event_id", "student_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_club_starts_idx" ON "events" ("club_id", "starts_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_bookings_event_idx" ON "event_bookings" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_bookings_checkout_idx" ON "event_bookings" ("checkout_ref");
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "events" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "event_bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "event_bookings" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON events, event_bookings TO junbi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON events, event_bookings FROM anon, authenticated;
  END IF;
END $$;
