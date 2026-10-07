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
  const client = postgres(url, { max: 1, onnotice: () => {}, prepare: false });

  // The app's own login role. It can never bypass row-level security.
  // Hosted databases must set JUNBI_APP_DB_PASSWORD; the fallback is for local development only.
  const password = process.env.JUNBI_APP_DB_PASSWORD ?? (process.env.NODE_ENV === "production" ? null : "junbi_app");
  if (!password) throw new Error("Set JUNBI_APP_DB_PASSWORD");
  if (!/^[A-Za-z0-9_-]{8,}$/.test(password)) throw new Error("JUNBI_APP_DB_PASSWORD: use 8+ letters, digits, _ or -");
  await client.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      CREATE ROLE junbi_app LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS;
    ELSE
      ALTER ROLE junbi_app WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS;
    END IF;
  END $$;`);

  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
