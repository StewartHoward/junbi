-- Junbi's own admin page lists every club. Clubs are walled off from each other by row-level
-- security, so this one read-only function gathers the club list for it. The app only calls it
-- after checking the signed-in person is a Junbi admin (SUPER_ADMIN_EMAILS).
CREATE OR REPLACE FUNCTION admin_clubs()
RETURNS TABLE (
  club_id uuid, name text, plan text, founding boolean, trial_ends_on date,
  promo_code text, discount_percent integer, discount_months integer,
  created_at timestamptz, onboarded_at timestamptz,
  owner_name text, owner_email text,
  sites integer, staff integer, students_active integer, students_total integer, students_new_30d integer,
  payment_provider text, families_paying integer, collected_30d_pence integer, last_sign_in timestamptz
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
    (SELECT max(a.created_at) FROM auth_sessions a JOIN club_staff cs ON cs.user_id = a.user_id WHERE cs.club_id = c.id)
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
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION admin_clubs() FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION admin_clubs() TO junbi_app;
  END IF;
END $$;
