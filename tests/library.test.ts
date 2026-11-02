import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/* HQ: ebooks edited on the admin page, uploaded in chunks, sold free or paid. */

vi.mock("@/auth/admin", () => ({ requireSuperAdmin: async () => ({ id: "admin", name: "Admin", email: "hq@example.test" }), isSuperAdmin: () => true }));

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  process.env.PAYMENTS_FAKE = "1";
  await adminSql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await adminSql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'junbi_app') THEN
      CREATE ROLE junbi_app LOGIN PASSWORD 'junbi_app' NOSUPERUSER NOBYPASSRLS;
    END IF; END $$;`);
  await migrate(drizzle(adminSql), { migrationsFolder: "drizzle" });
});
afterAll(async () => {
  delete process.env.PAYMENTS_FAKE;
  await adminSql.end();
});

const base = { slug: "test-book", title: "Test Book", subtitle: "", pitch: "A test.", description: "", pages: 10, price: "0", worth: "", coverBg: "#111111", coverFg: "#ffffff", coverAccent: "#c8102e", forWho: [], contents: ["One"], tipHeading: "", tipBody: "", status: "draft" as const, sort: 5 };
const buyer = (email: string, items: string[]) => ({ name: "Pat Buyer", email, clubName: "Pat's Club", role: "Club owner" as const, arts: [], size: "Under 50 students" as const, system: "NEST" as const, items, marketingOk: false });

describe("HQ ebooks", () => {
  it("starts with the three books that used to be in the code", async () => {
    const { allEbooks } = await import("@/data/library");
    expect((await allEbooks()).map((b) => b.slug)).toEqual(["club-starter-kit", "full-classes", "paid-on-time"]);
  });

  it("checks prices, web addresses and that a PDF exists before going live", async () => {
    const lib = await import("@/data/library");
    expect((await lib.saveEbook(null, { ...base, slug: "Bad Slug" })).ok).toBe(false);
    expect((await lib.saveEbook(null, { ...base, slug: "full-classes" })).ok).toBe(false);
    const worth = await lib.saveEbook(null, { ...base, price: "9.99", worth: "5" });
    expect(worth.ok).toBe(false);
    expect((await lib.saveEbook(null, { ...base, status: "live" })).ok).toBe(false);
    const r = await lib.saveEbook(null, { ...base, price: "9.99", worth: "19" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const live = await lib.saveEbook(r.value.id, { ...base, price: "9.99", worth: "19", status: "live" });
    expect(live.ok).toBe(false); // no PDF yet
    const b = await lib.ebookBySlug("test-book", { drafts: true });
    expect(b).toMatchObject({ pricePence: 999, worthPence: 1900, status: "draft" });
    expect(await lib.ebookBySlug("test-book")).toBeNull(); // drafts are hidden from the shop
  });

  it("puts a PDF together from chunks, and only replaces the old one when the last chunk arrives", async () => {
    const lib = await import("@/data/library");
    const { UPLOAD_CHUNK } = await import("@/lib/ebooks");
    const b = (await lib.ebookBySlug("test-book", { drafts: true }))!;
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(UPLOAD_CHUNK + 1000, 7)]);
    const parts = [pdf.subarray(0, UPLOAD_CHUNK), pdf.subarray(UPLOAD_CHUNK)];
    expect((await lib.uploadChunk({ ebookId: b.id, kind: "pdf", index: 0, total: 2, size: pdf.length, name: "book.pdf", data: Buffer.from("not a pdf") })).ok).toBe(false);
    const first = await lib.uploadChunk({ ebookId: b.id, kind: "pdf", index: 0, total: 2, size: pdf.length, name: "book.pdf", data: parts[0] });
    expect(first.ok && first.value.done).toBe(false);
    expect(await lib.fileInfo("test-book", "pdf")).toBeNull(); // not swapped in yet
    const last = await lib.uploadChunk({ ebookId: b.id, kind: "pdf", index: 1, total: 2, size: pdf.length, name: "book.pdf", data: parts[1] });
    expect(last.ok && last.value.done).toBe(true);
    const info = (await lib.fileInfo("test-book", "pdf"))!;
    expect(info.chunks).toBe(2);
    const back = Buffer.concat([(await lib.fileChunk(info.ebookId, "pdf", 0))!, (await lib.fileChunk(info.ebookId, "pdf", 1))!]);
    expect(back.equals(pdf)).toBe(true);
    expect((await lib.saveEbook(b.id, { ...base, price: "9.99", worth: "19", status: "live" })).ok).toBe(true);
  });
});

describe("selling", () => {
  it("free orders are confirmed straight away and can download", async () => {
    const lib = await import("@/data/library");
    const crm = await import("@/data/crm");
    const b = (await lib.ebookBySlug("test-book"))!;
    await lib.saveEbook(b.id, { ...base, price: "0", status: "live" });
    const r = await crm.placeLibraryOrder(buyer("free@example.test", ["test-book"]));
    expect(r.ok && r.value.payUrl).toBe(null);
    if (!r.ok) return;
    const o = await crm.libraryOrder(r.value.token);
    expect(o?.status).toBe("free");
    const url = new URL(o!.items[0].downloadUrl!);
    expect((await crm.libraryDownload(url.searchParams.get("t")))?.slug).toBe("test-book");
  });

  it("paid orders wait for payment before anything can be downloaded", async () => {
    const lib = await import("@/data/library");
    const crm = await import("@/data/crm");
    const b = (await lib.ebookBySlug("test-book"))!;
    await lib.saveEbook(b.id, { ...base, price: "9.99", worth: "19", status: "live" });
    const r = await crm.placeLibraryOrder(buyer("paid@example.test", ["test-book"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.payUrl).toContain("cs_fake_");
    const before = await crm.libraryOrder(r.value.token);
    expect(before).toMatchObject({ status: "pending", amountPence: 999 });
    expect(before!.items[0].downloadUrl).toBeNull();
    const session = new URL(r.value.payUrl!).searchParams.get("paid")!;
    expect(await crm.markLibraryOrderPaid("00000000-0000-0000-0000-000000000000", session)).toBe(false);
    const after = await crm.libraryOrder(r.value.token, session);
    expect(after?.status).toBe("paid");
    expect(after!.items[0].downloadUrl).toBeTruthy();
    const kinds = (await adminSql`select e.kind from crm_events e join crm_contacts c on c.id = e.contact_id where c.email = 'paid@example.test'`).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["order", "paid", "delivered"]));
  });

  it("won't delete an ebook someone has ordered", async () => {
    const lib = await import("@/data/library");
    const b = (await lib.ebookBySlug("test-book"))!;
    expect((await lib.deleteEbook(b.id)).ok).toBe(false);
    const fresh = await lib.saveEbook(null, { ...base, slug: "unused-book" });
    expect(fresh.ok && (await lib.deleteEbook(fresh.value.id)).ok).toBe(true);
  });
});

describe("shop dashboard", () => {
  it("counts free, paid and abandoned orders and the money taken", async () => {
    const crm = await import("@/data/crm");
    const shop = await import("@/data/shop-admin");
    const r = await crm.placeLibraryOrder(buyer("left@example.test", ["test-book"]));
    expect(r.ok).toBe(true);
    await adminSql`update crm_orders set created_at = now() - interval '2 hours' where status = 'pending'`;
    const d = await shop.shopDashboard();
    expect(d.ready).toBe(true);
    expect(d.kpi).toMatchObject({ free: 1, paid: 1, abandoned: 1, revenue: 999, orders: 2 });
    expect(d.days).toHaveLength(30);
    expect(d.sellers[0]).toMatchObject({ slug: "test-book", orders: 2 });
    const all = await shop.shopOrders({});
    expect(all.counts).toMatchObject({ all: 3, paid: 1, free: 1, abandoned: 1, pending: 0 });
    expect((await shop.shopOrders({ status: "abandoned" })).orders.map((o) => o.email)).toEqual(["left@example.test"]);
    expect((await shop.shopOrders({ q: "paid@" })).orders).toHaveLength(1);
    const csv = await shop.ordersCsv();
    expect(csv.split("\n")).toHaveLength(4);
    expect(csv).toContain("Abandoned");
  });
});

