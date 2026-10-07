-- Website sign-ups: the app can add a row but can never read, change or delete them.
-- Staff read sign-ups from the database dashboard as the owner.
ALTER TABLE "founding_club_signups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    REVOKE ALL ON "founding_club_signups" FROM junbi_app;
    GRANT INSERT ON "founding_club_signups" TO junbi_app;
    CREATE POLICY website_insert_only ON "founding_club_signups" FOR INSERT TO junbi_app WITH CHECK (consent_to_contact);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "founding_club_signups" FROM anon, authenticated;
  END IF;
END $$;
