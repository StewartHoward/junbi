-- Payment accounts and setups belong to a club: normal tenant isolation.
ALTER TABLE "club_payment_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "club_payment_accounts" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "payment_setups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "payment_setups" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
-- A provider account can only be connected to one club.
CREATE UNIQUE INDEX IF NOT EXISTS "club_payment_accounts_provider_account_key" ON "club_payment_accounts" ("provider", "account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mandates_provider_mandate_idx" ON "mandates" ("provider_mandate_id");
--> statement-breakpoint
-- Webhooks arrive without a signed-in club; this finds which club a provider account belongs to.
CREATE OR REPLACE FUNCTION payments_club_for_account(p_provider text, p_account_id text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT club_id FROM club_payment_accounts WHERE provider = p_provider AND account_id = p_account_id
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION payments_club_for_account(text, text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION payments_club_for_account(text, text) FROM anon, authenticated;
    REVOKE ALL ON club_payment_accounts, payment_setups FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION payments_club_for_account(text, text) TO junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON club_payment_accounts, payment_setups TO junbi_app;
  END IF;
END $$;
