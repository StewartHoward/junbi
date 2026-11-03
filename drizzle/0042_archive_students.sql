-- Students who have left can be archived: hidden from lists, registers and messages, history kept, and restorable.
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'archived';
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at timestamptz;
--> statement-breakpoint
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_from text;
