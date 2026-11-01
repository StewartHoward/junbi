-- Website editor: photos the club uploads for its website, and its own domain name.
CREATE TABLE IF NOT EXISTS "website_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"mime" text NOT NULL CHECK ("mime" IN ('image/jpeg', 'image/png', 'image/webp')),
	"data" bytea NOT NULL CHECK (octet_length("data") <= 2000000),
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_images_club_idx" ON "website_images" ("club_id");
--> statement-breakpoint
ALTER TABLE "website_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "website_images" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
-- Photos are shown on public club pages, so anyone can fetch one by its id (ids can't be guessed).
CREATE OR REPLACE FUNCTION website_image(p_id uuid)
RETURNS TABLE (mime text, data bytea)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.mime, i.data FROM website_images i WHERE i.id = p_id
$$;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "custom_domain" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clubs_custom_domain_key" ON "clubs" ("custom_domain") WHERE "custom_domain" IS NOT NULL;
--> statement-breakpoint
-- Finds the club for a domain (with or without www), for requests that arrive on a club's own domain.
CREATE OR REPLACE FUNCTION club_by_domain(p_host text)
RETURNS TABLE (club_id uuid, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.slug FROM clubs c
  WHERE length(p_host) BETWEEN 4 AND 253 AND c.custom_domain IS NOT NULL AND c.website_published
    AND (c.custom_domain = lower(p_host) OR 'www.' || c.custom_domain = lower(p_host) OR c.custom_domain = 'www.' || lower(p_host))
  LIMIT 1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION club_domain_taken(p_host text, p_club uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM clubs WHERE custom_domain = lower(p_host) AND id <> p_club)
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION website_image(uuid) FROM PUBLIC;
  REVOKE ALL ON FUNCTION club_by_domain(text) FROM PUBLIC;
  REVOKE ALL ON FUNCTION club_domain_taken(text, uuid) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON website_images FROM anon, authenticated;
    REVOKE ALL ON FUNCTION website_image(uuid) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION club_by_domain(text) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION club_domain_taken(text, uuid) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, DELETE ON website_images TO junbi_app;
    GRANT EXECUTE ON FUNCTION website_image(uuid) TO junbi_app;
    GRANT EXECUTE ON FUNCTION club_by_domain(text) TO junbi_app;
    GRANT EXECUTE ON FUNCTION club_domain_taken(text, uuid) TO junbi_app;
  END IF;
END $$;
