-- Finds the club behind a family sign-up link, so a parent who isn't signed in can join it.
-- Only for clubs that have finished set-up. Everything after this runs under normal club isolation.
CREATE OR REPLACE FUNCTION join_club_lookup(p_token text)
RETURNS TABLE (club_id uuid, club_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name FROM clubs c
  WHERE length(p_token) BETWEEN 32 AND 100 AND c.join_token = p_token AND c.onboarded_at IS NOT NULL
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION join_club_lookup(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION join_club_lookup(text) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION join_club_lookup(text) TO junbi_app;
  END IF;
END $$;
