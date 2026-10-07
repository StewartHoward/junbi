-- Before a request knows which club it belongs to, it needs the signed-in user's staff roles.
-- This narrow SECURITY DEFINER function returns only that user's own memberships.
CREATE OR REPLACE FUNCTION staff_memberships_for(p_user_id uuid)
RETURNS TABLE (staff_id uuid, club_id uuid, club_name text, role staff_role, all_sites boolean, site_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.club_id, c.name, s.role, s.all_sites,
         coalesce(array_agg(ss.site_id) FILTER (WHERE ss.site_id IS NOT NULL), '{}')
  FROM club_staff s
  JOIN clubs c ON c.id = s.club_id
  LEFT JOIN staff_sites ss ON ss.staff_id = s.id
  WHERE s.user_id = p_user_id
  GROUP BY s.id, c.name
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_memberships_for(uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION staff_memberships_for(uuid) TO junbi_app;
  END IF;
END $$;
