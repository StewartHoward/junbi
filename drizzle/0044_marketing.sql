-- Admin → Marketing: Junbi's own email marketing to clubs. A prospect list (clubs found in public directories or
-- added by hand), campaigns written in the email creator, and a record of every send so nobody gets the same email twice.
-- These belong to Junbi, not to any club, so they aren't tenant tables. Only the app reads them; admin screens check
-- for a Junbi admin in the app before showing anything.
CREATE TABLE IF NOT EXISTS mkt_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  club_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  town text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  style text NOT NULL DEFAULT '' CHECK (style IN ('', 'WT', 'ITF')),
  organisation text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  venues int NOT NULL DEFAULT 1 CHECK (venues >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'do_not_email')),
  unsubscribed_at timestamptz,
  emails_sent int NOT NULL DEFAULT 0,
  last_emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mkt_prospects_status ON mkt_prospects (status, style);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mkt_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  heading text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT '',
  button_url text NOT NULL DEFAULT '',
  audience_style text NOT NULL DEFAULT 'all' CHECK (audience_style IN ('all', 'WT', 'ITF')),
  audience_source text NOT NULL DEFAULT '',
  follows_campaign_id uuid REFERENCES mkt_campaigns(id) ON DELETE SET NULL,
  delay_days int NOT NULL DEFAULT 0 CHECK (delay_days BETWEEN 0 AND 60),
  daily_limit int NOT NULL DEFAULT 100 CHECK (daily_limit BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'paused', 'sent')),
  test_sent_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mkt_sends (
  campaign_id uuid NOT NULL REFERENCES mkt_campaigns(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES mkt_prospects(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  provider_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, prospect_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mkt_sends_sent_at ON mkt_sends (campaign_id, sent_at);
--> statement-breakpoint
ALTER TABLE mkt_prospects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE mkt_campaigns ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE mkt_sends ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON mkt_prospects, mkt_campaigns, mkt_sends FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON mkt_prospects, mkt_campaigns, mkt_sends FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON mkt_prospects, mkt_campaigns TO junbi_app;
    GRANT SELECT, INSERT, UPDATE ON mkt_sends TO junbi_app;
    DROP POLICY IF EXISTS mkt_prospects_app ON mkt_prospects;
    DROP POLICY IF EXISTS mkt_campaigns_app ON mkt_campaigns;
    DROP POLICY IF EXISTS mkt_sends_app ON mkt_sends;
    CREATE POLICY mkt_prospects_app ON mkt_prospects TO junbi_app USING (true) WITH CHECK (true);
    CREATE POLICY mkt_campaigns_app ON mkt_campaigns TO junbi_app USING (true) WITH CHECK (true);
    CREATE POLICY mkt_sends_app ON mkt_sends TO junbi_app USING (true) WITH CHECK (true);
  END IF;
END $$;
--> statement-breakpoint
-- True when this address belongs to someone on the staff of any Junbi club, so "try Junbi" emails never go to people
-- who already use it. The app role can't read users across clubs, so this answers yes or no and nothing more.
CREATE OR REPLACE FUNCTION mkt_is_junbi_staff(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM users u JOIN club_staff cs ON cs.user_id = u.id WHERE lower(u.email) = lower(p_email))
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION mkt_is_junbi_staff(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION mkt_is_junbi_staff(text) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION mkt_is_junbi_staff(text) TO junbi_app;
  END IF;
END $$;
