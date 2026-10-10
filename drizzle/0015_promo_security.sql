-- Discount codes are reached only through the functions below.
ALTER TABLE "promo_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION promo_check(p_code text)
RETURNS TABLE (code text, percent_off int, months int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code, p.percent_off, p.months FROM promo_codes p
  WHERE p.code = upper(trim(p_code))
    AND (p.expires_at IS NULL OR p.expires_at > now())
    AND (p.max_uses IS NULL OR p.uses < p.max_uses)
$$;
--> statement-breakpoint
-- Applies a code to the caller's own club, once. A code worth 100% for good makes the club free,
-- so it has no trial end date.
CREATE OR REPLACE FUNCTION promo_redeem(p_code text, p_club_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p promo_codes%ROWTYPE;
BEGIN
  IF p_club_id IS DISTINCT FROM current_club_id() THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND promo_code IS NOT NULL) THEN RETURN NULL; END IF;
  SELECT * INTO p FROM promo_codes
  WHERE promo_codes.code = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE promo_codes SET uses = uses + 1 WHERE promo_codes.code = p.code;
  UPDATE clubs SET promo_code = p.code, discount_percent = p.percent_off, discount_months = p.months,
    trial_ends_on = CASE WHEN p.percent_off >= 100 AND p.months IS NULL THEN NULL ELSE trial_ends_on END
  WHERE id = p_club_id;
  RETURN p.percent_off;
END $$;
--> statement-breakpoint
-- Founding Clubs are capped at 10.
CREATE OR REPLACE FUNCTION founding_places_left()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, 10 - (SELECT count(*) FROM clubs WHERE founding)::int)
$$;
--> statement-breakpoint
-- The trial is now 7 days, so remind owners 3 days and 1 day before it ends.
CREATE OR REPLACE FUNCTION trial_reminders_due()
RETURNS TABLE (club_id uuid, club_name text, trial_ends_on date, days_left int, owner_email text, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.trial_ends_on, (c.trial_ends_on - (now() AT TIME ZONE 'Europe/London')::date)::int, u.email, u.name
  FROM clubs c
  JOIN club_staff s ON s.club_id = c.id AND s.role = 'owner'
  JOIN users u ON u.id = s.user_id
  WHERE c.trial_ends_on IS NOT NULL
    AND (c.trial_ends_on - (now() AT TIME ZONE 'Europe/London')::date) IN (3, 1)
$$;
--> statement-breakpoint
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['promo_check(text)', 'promo_redeem(text,uuid)', 'founding_places_left()', 'trial_reminders_due()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO junbi_app', f);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    REVOKE ALL ON promo_codes FROM junbi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON promo_codes FROM anon, authenticated;
  END IF;
END $$;
