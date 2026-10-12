-- One row per provider payment: a webhook delivered twice at once can't double-count money.
DELETE FROM payments a USING payments b
WHERE a.provider_payment_id IS NOT NULL AND a.provider_payment_id = b.provider_payment_id AND a.club_id = b.club_id AND a.ctid > b.ctid;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_key" ON "payments" ("club_id", "provider_payment_id");
--> statement-breakpoint
-- Using a reset link also cancels any other reset links for that person.
CREATE OR REPLACE FUNCTION auth_reset_use(p_token_hash text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  UPDATE password_resets SET used_at = now()
  WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
  RETURNING user_id INTO uid;
  IF uid IS NULL THEN RETURN NULL; END IF;
  UPDATE password_resets SET used_at = now() WHERE user_id = uid AND used_at IS NULL;
  UPDATE users SET password_hash = p_password_hash WHERE id = uid;
  DELETE FROM auth_sessions WHERE user_id = uid;
  DELETE FROM auth_failures WHERE email = (SELECT email FROM users WHERE id = uid);
  RETURN uid;
END $$;
