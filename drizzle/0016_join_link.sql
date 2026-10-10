ALTER TABLE "clubs" ADD COLUMN "join_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "source" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_join_token_key" ON "clubs" USING btree ("join_token");