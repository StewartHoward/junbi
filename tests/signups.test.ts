import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/db/schema";
import { parseSignupForm } from "@/data/signups";

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const valid = {
  clubName: "Southport Taekwondo",
  contactName: "Sam Lee",
  email: " Sam@Example.co.uk ",
  activeStudents: "51-150",
  sites: "2",
  plan: "club",
  consentToContact: "on",
};

describe("Founding Club form validation", () => {
  it("accepts a complete form and tidies values", () => {
    const r = parseSignupForm(form(valid));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.email).toBe("sam@example.co.uk");
    expect(r.data.sites).toBe(2);
    expect(r.data.plan).toBe("club");
    expect(r.data.phone).toBeNull();
  });

  it("requires consent", () => {
    const { consentToContact: _, ...rest } = valid;
    const r = parseSignupForm(form(rest));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain("consentToContact");
  });

  it("rejects a bad email and missing student band", () => {
    const r = parseSignupForm(form({ ...valid, email: "not-an-email", activeStudents: "" }));
    expect(r.success).toBe(false);
    const fields = r.error?.issues.map((i) => i.path[0]);
    expect(fields).toContain("email");
    expect(fields).toContain("activeStudents");
  });

  it("ignores an unknown plan rather than failing", () => {
    const r = parseSignupForm(form({ ...valid, plan: "platinum" }));
    expect(r.success).toBe(true);
    expect(r.success && r.data.plan).toBeNull();
  });
});

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://junbi_app:junbi_app@localhost:5432/junbi_test";

describe("Founding Club sign-ups table", () => {
  const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  const appSql = postgres(APP_URL, { max: 1 });
  const app = drizzle(appSql, { schema });

  beforeAll(async () => {
    await adminSql.unsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
        CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
      END IF; END $$;`);
    await migrate(drizzle(adminSql, { schema }), { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await adminSql.unsafe("DELETE FROM founding_club_signups WHERE email = 'sam@example.co.uk'");
    await adminSql.end();
    await appSql.end();
  });

  it("the website can add a sign-up", async () => {
    const r = parseSignupForm(form(valid));
    if (!r.success) throw new Error("fixture invalid");
    await expect(app.insert(schema.foundingClubSignups).values(r.data)).resolves.toBeDefined();
  });

  it("the website can never read sign-ups back", async () => {
    const err = await app.select().from(schema.foundingClubSignups).then(
      () => null,
      (e: Error & { cause?: Error }) => e,
    );
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/permission denied/);
  });

  it("a sign-up without consent is refused by the database", async () => {
    const err = await app
      .insert(schema.foundingClubSignups)
      .values({ clubName: "X", contactName: "Y", email: "sam@example.co.uk", activeStudents: "1-50", consentToContact: false })
      .then(
        () => null,
        (e: Error & { cause?: Error }) => e,
      );
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/row-level security/);
  });
});
