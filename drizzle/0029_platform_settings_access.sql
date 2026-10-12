-- Supabase switches row-level security on for new tables, which blocked the app saving Junbi's
-- billing setting. platform_settings holds no club data, so it doesn't need it.
ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE ON platform_settings TO junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON junbi_invoices TO junbi_app;
  END IF;
END $$;
