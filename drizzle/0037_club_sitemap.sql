-- Published club websites for the sitemap. Only the web address is returned, and only for clubs that have
-- chosen to publish their site.
CREATE OR REPLACE FUNCTION published_club_sites()
RETURNS TABLE (slug text, custom_domain text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.slug, c.custom_domain FROM clubs c
  WHERE c.website_published AND c.onboarded_at IS NOT NULL AND c.slug IS NOT NULL
  ORDER BY c.slug
  LIMIT 5000
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION published_club_sites() FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION published_club_sites() FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION published_club_sites() TO junbi_app;
  END IF;
END $$;
