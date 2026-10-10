-- Messages belong to a club: normal tenant isolation.
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "messages" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "message_recipients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "message_recipients" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_club_created_idx" ON "messages" ("club_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_recipients_message_idx" ON "message_recipients" ("message_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON messages, message_recipients TO junbi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON messages, message_recipients FROM anon, authenticated;
  END IF;
END $$;
