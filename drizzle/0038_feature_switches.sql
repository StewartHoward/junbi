-- Switches to turn whole features on or off for every club, set from the Junbi admin page.
-- A feature with no row here is off.
CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
--> statement-breakpoint
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON feature_flags FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON feature_flags FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE ON feature_flags TO junbi_app;
    DROP POLICY IF EXISTS feature_flags_app ON feature_flags;
    CREATE POLICY feature_flags_app ON feature_flags TO junbi_app USING (true) WITH CHECK (true);
  END IF;
END $$;
