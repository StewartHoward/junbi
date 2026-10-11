CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "clubs"("id") ON DELETE cascade,
	"site_id" uuid REFERENCES "sites"("id") ON DELETE set null,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"student_name" text,
	"student_age" integer,
	"class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
	"session_at" timestamp with time zone,
	"source" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"converted_student_id" uuid REFERENCES "students"("id") ON DELETE set null,
	"converted_at" timestamp with time zone,
	"welcome_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Leads belong to a club: normal tenant isolation.
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "leads" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_club_created_idx" ON "leads" ("club_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_reminder_due_idx" ON "leads" ("session_at") WHERE "reminder_sent_at" IS NULL;
--> statement-breakpoint
-- Reminder emails run on a schedule without a signed-in club: this lists the leads whose trial
-- session is in the next 24 hours and who haven't had their reminder yet, across all clubs.
CREATE OR REPLACE FUNCTION lead_reminders_due()
RETURNS TABLE (lead_id uuid, club_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.club_id FROM leads l
  WHERE l.reminder_sent_at IS NULL
    AND l.email IS NOT NULL
    AND l.status IN ('new', 'booked')
    AND l.session_at > now() + interval '1 hour'
    AND l.session_at <= now() + interval '24 hours'
    AND l.session_at - l.created_at > interval '24 hours'
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION lead_reminders_due() FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION lead_reminders_due() FROM anon, authenticated;
    REVOKE ALL ON leads FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION lead_reminders_due() TO junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO junbi_app;
  END IF;
END $$;
