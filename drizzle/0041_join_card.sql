-- Families signing up with the club's link or QR code can pay by card as well as Direct Debit (Stripe clubs).
-- Clubs can switch card off. Each payment method records whether it's a Direct Debit or a card.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS join_card boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'direct_debit';
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE mandates ADD CONSTRAINT mandates_method CHECK (method IN ('direct_debit', 'card'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
