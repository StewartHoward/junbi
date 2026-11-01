-- Club shop: kit, uniforms and anything else the club sells. Families pay by card on the club's own Stripe
-- (or at the club), and staff hand the order over.
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"description" text,
	"price_pence" integer NOT NULL CHECK ("price_pence" > 0),
	-- Sizes or other choices, e.g. {"110cm","120cm","130cm"}. Empty = no choice.
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"household_id" uuid REFERENCES "public"."households"("id") ON DELETE set null,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"note" text,
	"total_pence" integer NOT NULL,
	-- pending (paying now), paid, to_pay (pay at the club), handed_over, cancelled
	"status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'paid', 'to_pay', 'handed_over', 'cancelled')),
	"paid" boolean DEFAULT false NOT NULL,
	"checkout_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL REFERENCES "public"."clubs"("id") ON DELETE cascade,
	"order_id" uuid NOT NULL REFERENCES "public"."orders"("id") ON DELETE cascade,
	"product_id" uuid REFERENCES "public"."products"("id") ON DELETE set null,
	"name" text NOT NULL,
	"option" text,
	"quantity" integer NOT NULL CHECK ("quantity" BETWEEN 1 AND 50),
	"unit_pence" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_club_created_idx" ON "orders" ("club_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_checkout_idx" ON "orders" ("checkout_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "products" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "orders" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order_items" USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
--> statement-breakpoint
-- Club website: a simple public page built from the club's Junbi details, at junbi.co.uk/c/<slug>.
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "website_published" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "website" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
-- Finds a club by its web address, for the public club page and shop. Everything after runs under club isolation.
CREATE OR REPLACE FUNCTION club_by_slug(p_slug text)
RETURNS TABLE (club_id uuid, club_name text, published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.website_published FROM clubs c
  WHERE length(p_slug) BETWEEN 2 AND 60 AND c.slug = lower(p_slug) AND c.onboarded_at IS NOT NULL
$$;
--> statement-breakpoint
-- Whether a web address is free (slugs are unique across every club).
CREATE OR REPLACE FUNCTION club_slug_taken(p_slug text, p_club uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM clubs WHERE slug = lower(p_slug) AND id <> p_club)
$$;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON FUNCTION club_by_slug(text) FROM PUBLIC;
  REVOKE ALL ON FUNCTION club_slug_taken(text, uuid) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON products, orders, order_items FROM anon, authenticated;
    REVOKE ALL ON FUNCTION club_by_slug(text) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION club_slug_taken(text, uuid) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON products, orders, order_items TO junbi_app;
    GRANT EXECUTE ON FUNCTION club_by_slug(text) TO junbi_app;
    GRANT EXECUTE ON FUNCTION club_slug_taken(text, uuid) TO junbi_app;
  END IF;
END $$;
