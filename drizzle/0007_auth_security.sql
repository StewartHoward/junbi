-- Real sign-in. The app role never touches auth_sessions or auth_failures directly;
-- it goes through the narrow SECURITY DEFINER functions below.
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_failures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "club_disciplines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "club_disciplines" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_create_user(p_email text, p_name text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO users (email, name, password_hash) VALUES (lower(trim(p_email)), p_name, p_password_hash)
  RETURNING id INTO new_id;
  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_login_lookup(p_email text)
RETURNS TABLE (user_id uuid, password_hash text, recent_failures int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.password_hash,
         (SELECT count(*)::int FROM auth_failures f WHERE f.email = lower(trim(p_email)) AND f.at > now() - interval '15 minutes')
  FROM (SELECT lower(trim(p_email)) AS email) q
  LEFT JOIN users u ON u.email = q.email
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_record_failure(p_email text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_failures WHERE at < now() - interval '1 day';
  INSERT INTO auth_failures (email) VALUES (lower(trim(p_email)));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_clear_failures(p_email text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_failures WHERE email = lower(trim(p_email));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_session_create(p_token_hash text, p_user_id uuid, p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_sessions WHERE expires_at < now();
  INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (p_token_hash, p_user_id, p_expires_at);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_session_user(p_token_hash text)
RETURNS TABLE (user_id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name, u.email FROM auth_sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash AND s.expires_at > now()
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_session_delete(p_token_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM auth_sessions WHERE token_hash = p_token_hash;
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS demo_staff_list();
--> statement-breakpoint
DROP FUNCTION IF EXISTS staff_memberships_for(uuid);
--> statement-breakpoint
CREATE FUNCTION staff_memberships_for(p_user_id uuid)
RETURNS TABLE (staff_id uuid, club_id uuid, club_name text, role staff_role, all_sites boolean, site_ids uuid[], onboarded boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.club_id, c.name, s.role, s.all_sites,
         coalesce(array_agg(ss.site_id) FILTER (WHERE ss.site_id IS NOT NULL), '{}'),
         c.onboarded_at IS NOT NULL
  FROM club_staff s
  JOIN clubs c ON c.id = s.club_id
  LEFT JOIN staff_sites ss ON ss.staff_id = s.id
  WHERE s.user_id = p_user_id
  GROUP BY s.id, c.name, c.onboarded_at
  ORDER BY min(s.created_at)
$$;
--> statement-breakpoint
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'auth_create_user(text,text,text)', 'auth_login_lookup(text)', 'auth_record_failure(text)',
    'auth_clear_failures(text)', 'auth_session_create(text,uuid,timestamptz)', 'auth_session_user(text)',
    'auth_session_delete(text)', 'staff_memberships_for(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO junbi_app', f);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    REVOKE ALL ON auth_sessions, auth_failures FROM junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON club_disciplines TO junbi_app;
    -- Users are created only through auth_create_user; the app may not insert or rewrite them directly.
    REVOKE INSERT, UPDATE, DELETE ON users FROM junbi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON auth_sessions, auth_failures, club_disciplines FROM anon, authenticated;
  END IF;
END $$;
