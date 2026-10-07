import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { withClub, type Db } from "@/db/client";

/*
 * Proves the database refuses to leak one club's data to another,
 * using a real Postgres and the same non-superuser role the app uses.
 */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://junbi_app:junbi_app@localhost:5432/junbi_test";

const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
const appSql = postgres(APP_URL, { max: 2 });
const admin = drizzle(adminSql, { schema });
const app: Db = drizzle(appSql, { schema });

let clubA: string;
let clubB: string;
let siteB: string;
let householdB: string;

beforeAll(async () => {
  await adminSql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await adminSql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
    END IF; END $$;`);
  await migrate(admin, { migrationsFolder: "drizzle" });

  // Seed two clubs as the owner role (bypasses RLS on purpose).
  const [a, b] = await admin
    .insert(schema.clubs)
    .values([
      { name: "Club A", slug: "club-a" },
      { name: "Club B", slug: "club-b" },
    ])
    .returning();
  clubA = a.id;
  clubB = b.id;

  for (const club of [a, b]) {
    const [site] = await admin.insert(schema.sites).values({ clubId: club.id, name: `${club.name} HQ` }).returning();
    const [hh] = await admin.insert(schema.households).values({ clubId: club.id, name: `${club.name} family` }).returning();
    await admin.insert(schema.students).values({
      clubId: club.id,
      householdId: hh.id,
      siteId: site.id,
      firstName: club.name === "Club A" ? "Alice" : "Bob",
      lastName: "Test",
      status: "active",
      medicalNotes: "Private note",
    });
    if (club.id === clubB) {
      siteB = site.id;
      householdB = hh.id;
    }
  }
});

afterAll(async () => {
  await appSql.end();
  await adminSql.end();
});

describe("tenant isolation (row-level security)", () => {
  it("the app connects as a role that cannot bypass RLS", async () => {
    const [row] = await appSql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(row.rolsuper).toBe(false);
    expect(row.rolbypassrls).toBe(false);
  });

  it("every tenant table has row-level security switched on", async () => {
    const rows = await adminSql`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'`;
    const enabled = new Map(rows.map((r) => [r.relname as string, r.relrowsecurity as boolean]));
    for (const table of [...schema.TENANT_TABLES, "clubs", "users"]) {
      expect(enabled.get(table), `RLS on ${table}`).toBe(true);
    }
  });

  it("a club only sees its own students, even with no WHERE clause", async () => {
    const names = await withClub({ clubId: clubA }, (tx) => tx.select().from(schema.students), app);
    expect(names.map((s) => s.firstName)).toEqual(["Alice"]);
  });

  it("asking for another club's student by id returns nothing", async () => {
    const [bob] = await withClub({ clubId: clubB }, (tx) => tx.select().from(schema.students), app);
    const leaked = await withClub(
      { clubId: clubA },
      (tx) => tx.select().from(schema.students).where(eq(schema.students.id, bob.id)),
      app,
    );
    expect(leaked).toHaveLength(0);
  });

  it("with no club set, nothing is visible", async () => {
    const rows = await app.select().from(schema.students);
    expect(rows).toHaveLength(0);
  });

  it("a club cannot write rows into another club", async () => {
    const err = await withClub(
      { clubId: clubA },
      (tx) =>
        tx.insert(schema.students).values({
          clubId: clubB,
          householdId: householdB,
          siteId: siteB,
          firstName: "Intruder",
          lastName: "Test",
        }),
      app,
    ).then(
      () => null,
      (e: unknown) => e as Error & { cause?: Error },
    );
    expect(err).not.toBeNull();
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/row-level security/);
  });

  it("a club cannot update another club's rows", async () => {
    const updated = await withClub(
      { clubId: clubA },
      (tx) => tx.update(schema.students).set({ firstName: "Hacked" }).where(sql`true`).returning(),
      app,
    );
    expect(updated.map((s) => s.firstName)).toEqual(["Hacked"]);
    const [bob] = await withClub({ clubId: clubB }, (tx) => tx.select().from(schema.students), app);
    expect(bob.firstName).toBe("Bob");
  });
});
