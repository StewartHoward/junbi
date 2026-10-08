-- Staff invites belong to a club: normal tenant isolation.
ALTER TABLE "staff_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "staff_invites" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
-- Password resets and the email log are reached only through the functions below.
ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_reset_create(p_email text, p_token_hash text, p_expires_at timestamptz)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM users WHERE email = lower(trim(p_email));
  IF NOT FOUND THEN RETURN; END IF;
  -- At most three reset emails an hour per person.
  IF (SELECT count(*) FROM password_resets r WHERE r.user_id = u.id AND r.created_at > now() - interval '1 hour') >= 3 THEN
    RETURN;
  END IF;
  DELETE FROM password_resets r WHERE r.expires_at < now() - interval '1 day';
  INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (p_token_hash, u.id, p_expires_at);
  RETURN QUERY SELECT u.id, u.name;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_reset_valid(p_token_hash text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM password_resets WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now())
$$;
--> statement-breakpoint
-- Sets the new password, uses up the link and signs the person out everywhere else.
CREATE OR REPLACE FUNCTION auth_reset_use(p_token_hash text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  UPDATE password_resets SET used_at = now()
  WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
  RETURNING user_id INTO uid;
  IF uid IS NULL THEN RETURN NULL; END IF;
  UPDATE users SET password_hash = p_password_hash WHERE id = uid;
  DELETE FROM auth_sessions WHERE user_id = uid;
  DELETE FROM auth_failures WHERE email = (SELECT email FROM users WHERE id = uid);
  RETURN uid;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION invite_lookup(p_token_hash text)
RETURNS TABLE (invite_id uuid, club_id uuid, club_name text, email text, role staff_role, inviter_name text, user_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.club_id, c.name, i.email, i.role, u.name,
         EXISTS (SELECT 1 FROM users x WHERE x.email = i.email)
  FROM staff_invites i
  JOIN clubs c ON c.id = i.club_id
  LEFT JOIN users u ON u.id = i.invited_by
  WHERE i.token_hash = p_token_hash AND i.accepted_at IS NULL AND i.expires_at > now()
$$;
--> statement-breakpoint
-- Adds the user to the club with the invited role. The user's email must match the invite.
CREATE OR REPLACE FUNCTION invite_accept(p_token_hash text, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv staff_invites%ROWTYPE; sid uuid;
BEGIN
  SELECT * INTO inv FROM staff_invites
  WHERE token_hash = p_token_hash AND accepted_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND email = inv.email) THEN RETURN NULL; END IF;

  INSERT INTO club_staff (club_id, user_id, role, all_sites)
  VALUES (inv.club_id, p_user_id, inv.role, inv.all_sites)
  ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, all_sites = EXCLUDED.all_sites
  RETURNING id INTO sid;

  DELETE FROM staff_sites WHERE staff_id = sid;
  INSERT INTO staff_sites (club_id, staff_id, site_id)
  SELECT inv.club_id, sid, s.id FROM sites s WHERE s.club_id = inv.club_id AND s.id = ANY (inv.site_ids);

  UPDATE staff_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.club_id;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION email_already_sent(p_dedupe_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM email_log WHERE dedupe_key = p_dedupe_key AND status = 'sent')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION email_log_write(p_club_id uuid, p_to text, p_template text, p_dedupe_key text, p_status text, p_provider_id text, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO email_log (club_id, to_email, template, dedupe_key, status, provider_id, error)
  VALUES (p_club_id, p_to, p_template, CASE WHEN p_status = 'sent' THEN p_dedupe_key END, p_status, p_provider_id, left(p_error, 500))
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;
--> statement-breakpoint
-- Clubs whose free trial ends in 7, 3 or 1 days, with their owners, for reminder emails.
CREATE OR REPLACE FUNCTION trial_reminders_due()
RETURNS TABLE (club_id uuid, club_name text, trial_ends_on date, days_left int, owner_email text, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.trial_ends_on, (c.trial_ends_on - (now() AT TIME ZONE 'Europe/London')::date)::int, u.email, u.name
  FROM clubs c
  JOIN club_staff s ON s.club_id = c.id AND s.role = 'owner'
  JOIN users u ON u.id = s.user_id
  WHERE c.trial_ends_on IS NOT NULL
    AND (c.trial_ends_on - (now() AT TIME ZONE 'Europe/London')::date) IN (7, 3, 1)
$$;
--> statement-breakpoint
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'auth_reset_create(text,text,timestamptz)', 'auth_reset_valid(text)', 'auth_reset_use(text,text)',
    'invite_lookup(text)', 'invite_accept(text,uuid)', 'email_already_sent(text)',
    'email_log_write(uuid,text,text,text,text,text,text)', 'trial_reminders_due()'
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
    REVOKE ALL ON password_resets, email_log FROM junbi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON staff_invites TO junbi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON password_resets, email_log, staff_invites FROM anon, authenticated;
  END IF;
END $$;
