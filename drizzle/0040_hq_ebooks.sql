-- HQ: ebooks for the Junbi Library are managed from the Junbi admin page instead of in code.
-- Files (PDFs and cover images) are stored in chunks so large files fit through the upload limit.
CREATE TABLE IF NOT EXISTS library_ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 60),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  subtitle text NOT NULL DEFAULT '',
  pitch text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  pages int NOT NULL DEFAULT 0 CHECK (pages BETWEEN 0 AND 2000),
  price_pence int NOT NULL DEFAULT 0 CHECK (price_pence BETWEEN 0 AND 100000),
  worth_pence int CHECK (worth_pence IS NULL OR worth_pence BETWEEN 0 AND 100000),
  cover_bg text NOT NULL DEFAULT '#1d1d1f' CHECK (cover_bg ~ '^#[0-9a-fA-F]{6}$'),
  cover_fg text NOT NULL DEFAULT '#ffffff' CHECK (cover_fg ~ '^#[0-9a-fA-F]{6}$'),
  cover_accent text NOT NULL DEFAULT '#c8102e' CHECK (cover_accent ~ '^#[0-9a-fA-F]{6}$'),
  for_who text[] NOT NULL DEFAULT '{}',
  contents text[] NOT NULL DEFAULT '{}',
  tip_heading text NOT NULL DEFAULT '',
  tip_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preorder', 'live')),
  sort int NOT NULL DEFAULT 0,
  pdf_name text,
  pdf_size int,
  pdf_uploaded_at timestamptz,
  cover_uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS library_files (
  ebook_id uuid NOT NULL REFERENCES library_ebooks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pdf', 'cover', 'pdf_upload')),
  chunk int NOT NULL CHECK (chunk BETWEEN 0 AND 99),
  data bytea NOT NULL,
  PRIMARY KEY (ebook_id, kind, chunk)
);
--> statement-breakpoint
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS amount_pence int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'free';
--> statement-breakpoint
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS stripe_session text;
--> statement-breakpoint
ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE crm_orders ADD CONSTRAINT crm_orders_status CHECK (status IN ('free', 'pending', 'paid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE crm_events DROP CONSTRAINT IF EXISTS crm_events_kind_check;
--> statement-breakpoint
ALTER TABLE crm_events ADD CONSTRAINT crm_events_kind_check CHECK (kind IN ('order', 'paid', 'delivered', 'download', 'email', 'note', 'stage', 'signup', 'unsubscribe', 'edit'));
--> statement-breakpoint
-- The three books that were in the code, so links and orders keep working.
INSERT INTO library_ebooks (slug, title, subtitle, pitch, pages, cover_bg, cover_fg, cover_accent, for_who, contents, tip_heading, tip_body, status, sort) VALUES
('club-starter-kit', 'The Club Starter Kit', 'Everything to sort before your first class, in the order you''ll need it', 'Qualifications, insurance, checks, a venue, prices and your first 20 students.', 32, '#1d1d1f', '#ffffff', '#c8102e',
 ARRAY['Instructors about to open their own club', 'Assistant instructors thinking about it', 'Anyone who''s just started and wants a checklist'],
 ARRAY['Associations, qualifications and what you actually need', 'DBS, PVG and AccessNI checks, first aid and safeguarding', 'Insurance in plain English', 'Finding a venue and agreeing the hire', 'Setting prices that cover your costs', 'The admin to have ready from day one', 'Finding your first 20 students', 'A 30-day launch checklist'],
 'Start with two classes, not six', 'New clubs that open with a full timetable spread a small number of students thinly and every class feels empty. Start with one junior and one adult class at times that suit families, fill them, then add more.', 'preorder', 1),
('full-classes', 'Full Classes', 'How martial arts clubs find students, turn trials into members and keep them', 'Your Google listing, trial classes that convert, and why members leave.', 40, '#c8102e', '#ffffff', '#f5c400',
 ARRAY['Club owners who want more students', 'Clubs with plenty of enquiries but too few joining', 'Anyone losing members after a few months'],
 ARRAY['Getting found on Google first', 'The trial class booking that turns maybe into yes', 'The day-before reminder and the first class', 'Asking them to join on the night', 'School tasters, holiday camps and referrals', 'Why members leave, and the warning signs', 'Simple numbers to track every month'],
 'Give every trial a real date', '"Come along whenever" loses people. Book every enquiry onto a real class and date there and then, and send a short reminder the day before. It''s the biggest single change most clubs can make to how many trials turn up.', 'preorder', 2),
('paid-on-time', 'Paid on Time', 'Pricing, Direct Debit and membership terms for martial arts clubs', 'Set prices with confidence, collect them without chasing, and raise them without losing members.', 28, '#1f4fbf', '#ffffff', '#f5c400',
 ARRAY['Clubs still collecting cash or bank transfers', 'Owners who haven''t raised prices in years', 'Anyone writing membership terms'],
 ARRAY['Working out what your classes really cost to run', 'Memberships families understand', 'Sign-up fees that feel like good value', 'Moving everyone to Direct Debit', 'Raising prices without losing members', 'Membership terms: what to include', 'Failed payments and how to handle them kindly'],
 'Raise a little every year', 'Small yearly rises with a month''s notice and a plain reason upset far fewer families than a big jump every few years. Many clubs keep existing members on their old price for a few months as a thank-you.', 'preorder', 3)
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
ALTER TABLE library_ebooks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON library_ebooks, library_files FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON library_ebooks, library_files FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON library_ebooks, library_files TO junbi_app;
    DROP POLICY IF EXISTS library_ebooks_app ON library_ebooks;
    DROP POLICY IF EXISTS library_files_app ON library_files;
    CREATE POLICY library_ebooks_app ON library_ebooks TO junbi_app USING (true) WITH CHECK (true);
    CREATE POLICY library_files_app ON library_files TO junbi_app USING (true) WITH CHECK (true);
  END IF;
END $$;
