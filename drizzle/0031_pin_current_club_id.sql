-- Supabase security advisor: pin current_club_id() to the public schema so it can't be pointed at a look-alike.
ALTER FUNCTION public.current_club_id() SET search_path = public;
