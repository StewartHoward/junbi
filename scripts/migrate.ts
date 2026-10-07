import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/**
 * Runs migrations as the database owner (DATABASE_ADMIN_URL).
 * In development it also creates the non-superuser `junbi_app` role the app connects as.
 */
async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL is not set");
  const client = postgres(url, { max: 1, onnotice: () => {} });

  if (process.env.NODE_ENV !== "production") {
    await client.unsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
        CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;`);
  }

  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
