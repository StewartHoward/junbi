-- DEMO DATABASES ONLY. Never run this on a database holding a real club's data.
-- Lets the demo sign-in page list the fake staff accounts using the restricted app login,
-- so the demo never needs the database owner's password.
CREATE OR REPLACE FUNCTION public.demo_staff_list()
RETURNS TABLE (id uuid, name text, email text, role staff_role, club text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name, u.email, s.role, c.name
  FROM users u
  JOIN club_staff s ON s.user_id = u.id
  JOIN clubs c ON c.id = s.club_id
  ORDER BY array_position(array['owner','admin','instructor','assistant']::staff_role[], s.role)
$$;
REVOKE ALL ON FUNCTION public.demo_staff_list() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT EXECUTE ON FUNCTION public.demo_staff_list() TO junbi_app;
  END IF;
END $$;
