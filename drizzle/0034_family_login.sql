-- Parent login: finds the families (in any club) that a parent's email belongs to, so they can sign in
-- with a link sent to that email. Everything after this runs under normal club isolation.
CREATE OR REPLACE FUNCTION family_households(p_email text)
RETURNS TABLE (club_id uuid, club_name text, household_id uuid, guardian_id uuid, first_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, g.household_id, g.id, g.first_name
  FROM guardians g
  JOIN clubs c ON c.id = g.club_id
  WHERE length(p_email) BETWEEN 3 AND 200 AND lower(g.email) = lower(p_email)
  ORDER BY c.name
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION family_households(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION family_households(text) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION family_households(text) TO junbi_app;
  END IF;
END $$;
