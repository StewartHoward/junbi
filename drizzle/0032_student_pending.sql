-- Students who signed up on the sign-up link but haven't set up their Direct Debit yet.
-- They show as "Awaiting payment" and aren't counted as members until it's set up.
ALTER TYPE public.student_status ADD VALUE IF NOT EXISTS 'pending';
