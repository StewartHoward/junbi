-- The Junbi Library (free ebooks with a £0 checkout) and the CRM on the Junbi admin page.
-- These belong to Junbi, not to any club, so they aren't tenant tables. Only the app reads them;
-- admin screens check for a Junbi admin in the app before showing anything.
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  name text NOT NULL DEFAULT '',
  club_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  arts text[] NOT NULL DEFAULT '{}',
  size_band text NOT NULL DEFAULT '',
  current_system text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'library',
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'demo', 'trial', 'customer', 'not_interested')),
  next_action_on date,
  marketing_ok boolean NOT NULL DEFAULT false,
  unsubscribed_at timestamptz,
  followup_step int NOT NULL DEFAULT 0,
  followup_due_at timestamptz,
  signed_up_club uuid REFERENCES clubs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS crm_contacts_followup ON crm_contacts (followup_due_at) WHERE followup_due_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS crm_contacts_activity ON crm_contacts (last_activity_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS crm_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number serial UNIQUE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  items text[] NOT NULL CHECK (cardinality(items) BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('order', 'delivered', 'download', 'email', 'note', 'stage', 'signup', 'unsubscribe', 'edit')),
  detail text NOT NULL DEFAULT '',
  by_whom text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS crm_events_contact ON crm_events (contact_id, created_at DESC);
--> statement-breakpoint
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE crm_orders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON crm_contacts, crm_orders, crm_events FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON crm_contacts, crm_orders, crm_events FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE ON crm_contacts, crm_orders, crm_events TO junbi_app;
    GRANT USAGE ON SEQUENCE crm_orders_number_seq TO junbi_app;
    DROP POLICY IF EXISTS crm_contacts_app ON crm_contacts;
    DROP POLICY IF EXISTS crm_orders_app ON crm_orders;
    DROP POLICY IF EXISTS crm_events_app ON crm_events;
    CREATE POLICY crm_contacts_app ON crm_contacts TO junbi_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_orders_app ON crm_orders TO junbi_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_events_app ON crm_events TO junbi_app USING (true) WITH CHECK (true);
  END IF;
END $$;
