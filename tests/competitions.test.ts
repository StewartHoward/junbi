import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/* Junbi Competitions waiting list: "tell me when it's live" goes into the CRM. */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://junbi_app:junbi_app@localhost:5432/junbi_test";
process.env.DATABASE_URL = APP_URL;

const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });

// Imported after DATABASE_URL is set; db() connects lazily on first use.
const comp = await import("@/data/competitions");

beforeAll(async () => {
  await adminSql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await adminSql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
    END IF; END $$;`);
  await migrate(drizzle(adminSql), { migrationsFolder: "drizzle" });
});
afterAll(async () => {
  await adminSql.end();
  await globalThis.__junbiSql?.end();
});

const contact = async (email: string) => (await adminSql`select * from crm_contacts where email = ${email}`)[0];

describe("competitions interest", () => {
  it("rejects a missing name and a bad email", async () => {
    const r = await comp.registerCompetitionInterest({ name: " ", email: "nope", interest: "host", marketingOk: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.email).toBeTruthy();
    }
  });

  it("rejects an unknown interest", async () => {
    const r = await comp.registerCompetitionInterest({ name: "Sam", email: "sam@example.test", interest: "spectate" as never, marketingOk: false });
    expect(r.ok).toBe(false);
  });

  it("adds a new contact with the competitions source, due a follow-up today, and logs a note", async () => {
    const r = await comp.registerCompetitionInterest({ name: "Alex Host", email: "Alex@Example.test", clubName: "Host Club", interest: "host", marketingOk: true });
    expect(r.ok).toBe(true);
    const c = await contact("alex@example.test");
    expect(c.source).toBe("competitions");
    expect(c.marketing_ok).toBe(true);
    expect(c.next_action_on).not.toBeNull();
    const [ev] = await adminSql`select * from crm_events where contact_id = ${c.id}`;
    expect(ev.kind).toBe("note");
    expect(ev.detail).toContain("hosting competitions for Host Club");
  });

  it("keeps an existing contact's source and never turns off their email consent", async () => {
    await adminSql`insert into crm_contacts (email, name, source, marketing_ok) values ('lib@example.test', 'Lib Reader', 'library', true)`;
    const r = await comp.registerCompetitionInterest({ name: "Lib Reader", email: "lib@example.test", interest: "enter", marketingOk: false });
    expect(r.ok).toBe(true);
    const c = await contact("lib@example.test");
    expect(c.source).toBe("library");
    expect(c.marketing_ok).toBe(true);
  });
});
