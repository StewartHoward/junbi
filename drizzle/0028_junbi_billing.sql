-- Junbi charging clubs: each club's subscription on Junbi's own Stripe account.
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "billing_customer_id" text;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "billing_subscription_id" text;
--> statement-breakpoint
-- Stripe's subscription status: trialing, active, past_due, unpaid, canceled, incomplete…
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "billing_status" text;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "billing_period_end" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "junbi_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "clubs"("id") ON DELETE cascade,
	"stripe_invoice_id" text NOT NULL,
	"amount_pence" integer NOT NULL,
	"status" text NOT NULL,
	"hosted_url" text,
	"period_start" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "junbi_invoices_stripe_key" ON "junbi_invoices" ("stripe_invoice_id");
--> statement-breakpoint
ALTER TABLE "junbi_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "junbi_invoices" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
-- Junbi-wide settings (the billing webhook's signing secret, encrypted). Not club data.
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Billing webhooks arrive without a signed-in club: this finds the club for a Stripe customer.
CREATE OR REPLACE FUNCTION billing_club_for_customer(p_customer text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM clubs WHERE billing_customer_id = p_customer LIMIT 1
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS admin_clubs();
--> statement-breakpoint
CREATE FUNCTION admin_clubs()
RETURNS TABLE (
  club_id uuid, name text, plan text, founding boolean, trial_ends_on date,
  promo_code text, discount_percent integer, discount_months integer,
  created_at timestamptz, onboarded_at timestamptz,
  owner_name text, owner_email text,
  sites integer, staff integer, students_active integer, students_total integer, students_new_30d integer,
  payment_provider text, families_paying integer, collected_30d_pence integer, last_sign_in timestamptz,
  billing_status text, billing_period_end timestamptz, junbi_paid_30d_pence integer, junbi_paid_total_pence integer, junbi_last_paid timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.name, c.plan, c.founding, c.trial_ends_on,
    c.promo_code, c.discount_percent, c.discount_months,
    c.created_at, c.onboarded_at,
    o.name, o.email,
    (SELECT count(*)::int FROM sites s WHERE s.club_id = c.id),
    (SELECT count(*)::int FROM club_staff cs WHERE cs.club_id = c.id),
    (SELECT count(*)::int FROM students st WHERE st.club_id = c.id AND st.status = 'active'),
    (SELECT count(*)::int FROM students st WHERE st.club_id = c.id),
    (SELECT count(*)::int FROM students st WHERE st.club_id = c.id AND st.created_at > now() - interval '30 days'),
    (SELECT pa.provider FROM club_payment_accounts pa WHERE pa.club_id = c.id),
    (SELECT count(DISTINCT m.household_id)::int FROM mandates m WHERE m.club_id = c.id AND m.status = 'active'),
    (SELECT coalesce(sum(p.amount_pence), 0)::int FROM payments p WHERE p.club_id = c.id AND p.status IN ('confirmed', 'paid_out') AND p.charge_date > current_date - 30),
    (SELECT max(a.created_at) FROM auth_sessions a JOIN club_staff cs ON cs.user_id = a.user_id WHERE cs.club_id = c.id),
    c.billing_status, c.billing_period_end,
    (SELECT coalesce(sum(i.amount_pence), 0)::int FROM junbi_invoices i WHERE i.club_id = c.id AND i.status = 'paid' AND i.paid_at > now() - interval '30 days'),
    (SELECT coalesce(sum(i.amount_pence), 0)::int FROM junbi_invoices i WHERE i.club_id = c.id AND i.status = 'paid'),
    (SELECT max(i.paid_at) FROM junbi_invoices i WHERE i.club_id = c.id AND i.status = 'paid')
  FROM clubs c
  LEFT JOIN LATERAL (
    SELECT u.name, u.email FROM club_staff cs JOIN users u ON u.id = cs.user_id
    WHERE cs.club_id = c.id AND cs.role = 'owner' ORDER BY cs.created_at LIMIT 1
  ) o ON true
  ORDER BY c.created_at DESC
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION admin_clubs() FROM PUBLIC;
  REVOKE ALL ON FUNCTION billing_club_for_customer(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION admin_clubs() FROM anon, authenticated;
    REVOKE ALL ON FUNCTION billing_club_for_customer(text) FROM anon, authenticated;
    REVOKE ALL ON junbi_invoices, platform_settings FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION admin_clubs() TO junbi_app;
    GRANT EXECUTE ON FUNCTION billing_club_for_customer(text) TO junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON junbi_invoices TO junbi_app;
    GRANT SELECT, INSERT, UPDATE ON platform_settings TO junbi_app;
  END IF;
END $$;
