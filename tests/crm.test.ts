import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as crm from "@/data/crm";
const EBOOKS = [{ slug: "club-starter-kit" }, { slug: "full-classes" }, { slug: "paid-on-time" }];

/* The Junbi Library's £0 checkout and the CRM behind it. */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });

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
});

const order = (o: Partial<crm.OrderInput> = {}): crm.OrderInput => ({
  name: "Sam Coach", email: "Sam@Example.test", clubName: "Sam's Dojo", role: "Club owner", arts: ["Karate"], size: "50 to 150", system: "NEST",
  items: [EBOOKS[0].slug], marketingOk: true, ...o,
});
const contact = async (email: string) => (await adminSql`select * from crm_contacts where email = ${email}`)[0];

describe("library checkout", () => {
  it("adds the buyer to the CRM with their order, and a confirmation page that works", async () => {
    const r = await crm.placeLibraryOrder(order());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = await contact("sam@example.test");
    expect(c).toMatchObject({ name: "Sam Coach", club_name: "Sam's Dojo", current_system: "NEST", stage: "new", marketing_ok: true, source: "library" });
    expect(c.arts).toEqual(["Karate"]);
    expect(c.followup_due_at).not.toBeNull();
    const page = await crm.libraryOrder(r.value.token);
    expect(page?.number).toBe(r.value.number);
    expect(page?.items.map((i) => i.book.slug)).toEqual([EBOOKS[0].slug]);
    expect(page?.items[0].downloadUrl).toBeNull(); // not ready yet, so it's a pre-order
    const kinds = (await adminSql`select kind from crm_events where contact_id = ${c.id}`).map((e) => e.kind);
    expect(kinds).toContain("order");
  });

  it("ordering again updates the same contact instead of adding a second one", async () => {
    const r = await crm.placeLibraryOrder(order({ items: [EBOOKS[1].slug], system: "Martialytics", marketingOk: false }));
    expect(r.ok).toBe(true);
    expect((await adminSql`select count(*)::int as n from crm_contacts where email = 'sam@example.test'`)[0].n).toBe(1);
    const c = await contact("sam@example.test");
    expect(c.current_system).toBe("Martialytics");
    expect(c.marketing_ok).toBe(true); // saying no on a later order doesn't undo an earlier yes
  });

  it("checks the form and ignores ebooks that don't exist", async () => {
    const bad = await crm.placeLibraryOrder(order({ email: "nope", items: ["made-up"] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.email).toBeTruthy();
    const none = await crm.placeLibraryOrder(order({ email: "x@example.test", items: ["made-up"] }));
    expect(none.ok).toBe(false);
    const noClub = await crm.placeLibraryOrder(order({ email: "y@example.test", clubName: "" }));
    expect(noClub.ok).toBe(false);
    const starting = await crm.placeLibraryOrder(order({ email: "z@example.test", clubName: "", role: "Thinking of starting a club", size: "Not open yet" }));
    expect(starting.ok).toBe(true);
  });

  it("rejects tampered order and download links", async () => {
    expect(await crm.libraryOrder("not-a-token")).toBeNull();
    expect(await crm.libraryDownload("not-a-token")).toBeNull();
  });
});

describe("follow-up emails", () => {
  it("only go to people who said yes, one step at a time, and stop on unsubscribe", async () => {
    await crm.placeLibraryOrder(order({ email: "no@example.test", marketingOk: false }));
    expect((await contact("no@example.test")).followup_due_at).toBeNull();

    await adminSql`update crm_contacts set followup_due_at = now() - interval '1 minute' where email = 'sam@example.test'`;
    const first = await crm.sendLibraryFollowups();
    expect(first.sent).toBe(1);
    let c = await contact("sam@example.test");
    expect(c.followup_step).toBe(1);
    expect(new Date(c.followup_due_at).getTime()).toBeGreaterThan(Date.now());
    expect((await crm.sendLibraryFollowups()).sent).toBe(0); // nothing due now

    const { signLink } = await import("@/lib/payments/crypto");
    expect(await crm.libraryUnsubscribe(signLink("library-unsub", { c: c.id }, 60))).toBe(true);
    c = await contact("sam@example.test");
    expect(c).toMatchObject({ marketing_ok: false, followup_due_at: null });
    await adminSql`update crm_contacts set followup_due_at = now() - interval '1 minute' where email = 'sam@example.test'`;
    expect((await crm.sendLibraryFollowups()).sent).toBe(0);
  });

  it("stop when the person signs up to Junbi, and they move to On trial", async () => {
    await crm.placeLibraryOrder(order({ email: "owner@example.test" }));
    const [club] = await adminSql`insert into clubs (name, slug) values ('Owner Club', 'owner-club') returning id`;
    await crm.linkSignupToCrm("OWNER@example.test", club.id, "Owner Club");
    const c = await contact("owner@example.test");
    expect(c).toMatchObject({ stage: "trial", signed_up_club: club.id, followup_due_at: null });
  });
});

describe("support messages", () => {
  it("checks the form, then notes the message on the sender's CRM record", async () => {
    const { sendSupportMessage } = await import("@/data/support");
    const bad = await sendSupportMessage({ name: "", email: "x", message: "hi", page: "", club: "" });
    expect(bad.ok).toBe(false);
    const r = await sendSupportMessage({ name: "Help Seeker", email: "Help@Example.test", message: "How do I import my students?", page: "/pricing", club: "Help Club" });
    expect(r.ok).toBe(true);
    const c = await contact("help@example.test");
    expect(c).toMatchObject({ name: "Help Seeker", club_name: "Help Club", source: "support" });
    const notes = await adminSql`select detail from crm_events where contact_id = ${c.id} and kind = 'note'`;
    expect(notes[0].detail).toContain("How do I import my students?");
  });
});

