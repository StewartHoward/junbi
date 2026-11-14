import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/* Admin → Marketing: the prospect list, the email creator and sending. No RESEND_API_KEY, so emails are logged, not sent. */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://junbi:junbi@localhost:5432/junbi_test";
const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://junbi_app:junbi_app@localhost:5432/junbi_test";
process.env.DATABASE_URL = APP_URL;
process.env.APP_URL = "https://junbi.test";
process.env.PAYMENT_SECRET ??= "test-secret-for-signing-links-0123456789";
vi.mock("@/auth/admin", () => ({ requireSuperAdmin: async () => ({ id: "admin", name: "Admin", email: "hq@example.test" }), isSuperAdmin: () => true }));

const adminSql = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
const m = await import("@/data/marketing");
const { renderMarketingEmail, tidyClubName, merge, RESULTS_DISCLAIMER } = await import("@/lib/marketing-email");
const { TRIAL_SEQUENCE } = await import("@/lib/marketing-templates");

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

const CSV = `Club,Email,Phone,Website,Style,Source
Spartans Taekwondo 218.001,timms@example.test,+447870322223,www.spartans.test,WT,British Taekwondo club locator
Spartans Taekwondo 218.005,TIMMS@example.test,,,WT,British Taekwondo club locator
Spartans Taekwondo,timms@example.test,,,WT,British Taekwondo club locator
Riverside TAGB,river@example.test,0123,,ITF,btc
No Email Club,,0123,,WT,
Bad Email,not-an-email,,,WT,
Already Customer,owner@club.test,,,WT,
Said No Via Library,nope@example.test,,,WT,`;

describe("prospect list", () => {
  it("imports a CSV, one prospect per email, counting venues and keeping the tidiest name", async () => {
    const r = await m.importProspects(CSV, { source: "manual", style: "" });
    expect(r).toEqual({ ok: true, value: { added: 4, updated: 0, skipped: 2 } });
    const [p] = await adminSql`select * from mkt_prospects where email = 'timms@example.test'`;
    expect(p).toMatchObject({ club_name: "Spartans Taekwondo", venues: 3, style: "WT", source: "british-taekwondo", phone: "+447870322223", status: "active" });
    const [itf] = await adminSql`select style, source from mkt_prospects where email = 'river@example.test'`;
    expect(itf).toEqual({ style: "ITF", source: "btc" });
  });

  it("importing again fills gaps but never re-subscribes anyone", async () => {
    await adminSql`update mkt_prospects set status = 'unsubscribed' where email = 'river@example.test'`;
    const r = await m.importProspects("Email,Town\nriver@example.test,Leeds", { source: "manual", style: "" });
    expect(r).toEqual({ ok: true, value: { added: 0, updated: 1, skipped: 0 } });
    const [p] = await adminSql`select status, town from mkt_prospects where email = 'river@example.test'`;
    expect(p).toEqual({ status: "unsubscribed", town: "Leeds" });
    await adminSql`update mkt_prospects set status = 'active' where email = 'river@example.test'`;
  });

  it("needs an Email column", async () => {
    const r = await m.importProspects("Club,Phone\nA,1", { source: "manual", style: "" });
    expect(r.ok).toBe(false);
  });
});

describe("the email", () => {
  it("fills in merge fields, tidies directory names and always carries the unsubscribe link and results disclaimer", () => {
    const e = renderMarketingEmail(TRIAL_SEQUENCE[0].content, { firstName: "Paul Timms", clubName: "Spartans Taekwondo 218.005" }, { unsubscribeUrl: "https://junbi.test/u?t=abc", reason: "Listed publicly." });
    expect(e.subject).toBe("Less admin for Spartans Taekwondo, free for 7 days");
    expect(e.text).toContain("Hi Paul,");
    expect(e.html).toContain("https://junbi.test/u?t=abc");
    expect(e.html).toContain("Results vary");
    expect(e.text).toContain(RESULTS_DISCLAIMER);
    expect(e.html).not.toContain("{{");
    expect(merge("Hi {{first_name}} at {{club_name}}", {})).toBe("Hi there at your club");
    expect(tidyClubName("LTA Falcons (Regular)")).toBe("LTA Falcons");
  });

  it("turns the price table into a real table, and the copy follows the house style", () => {
    const e = renderMarketingEmail(TRIAL_SEQUENCE[1].content, {}, { unsubscribeUrl: "#", reason: "" });
    expect(e.html).toContain("<table");
    expect(e.html).toContain("£197.64");
    for (const t of TRIAL_SEQUENCE) {
      const all = Object.values(t.content).join(" ");
      expect(all).not.toMatch(/—|–|!/); // no em dashes or exclamation marks
      expect(all).not.toMatch(/Total Taekwondo|AllSorted/i);
      expect(all).toContain("7 days");
    }
  });
});

describe("campaigns", () => {
  let id = "";

  it("makes the three trial emails as a linked sequence", async () => {
    const r = await m.createCampaign("trial-sequence");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    id = r.value.id;
    const rows = await adminSql`select id, name, follows_campaign_id, delay_days from mkt_campaigns order by created_at`;
    expect(rows).toHaveLength(3);
    expect(rows[1].follows_campaign_id).toBe(rows[0].id);
    expect(rows[2].follows_campaign_id).toBe(rows[1].id);
    expect(rows.map((r) => r.delay_days)).toEqual([0, 3, 4]);
  });

  it("won't start until a test of this version has been sent", async () => {
    const r = await m.startCampaign(id);
    expect(r.ok).toBe(false);
    expect((await m.sendTestEmail(id)).ok).toBe(true);
    const c = await m.getCampaign(id);
    expect(c?.campaign.testSentAt).not.toBeNull();
  });

  it("leaves out unsubscribed people, Library opt-outs, people on trial and existing Junbi users", async () => {
    const [u] = await adminSql`insert into users (email, name) values ('owner@club.test', 'Owner') returning id`;
    const [club] = await adminSql`insert into clubs (name, slug) values ('Owner Club', 'owner-club') returning id`;
    await adminSql`insert into club_staff (club_id, user_id, role) values (${club.id}, ${u.id}, 'owner')`;
    await adminSql`insert into crm_contacts (email, name, unsubscribed_at) values ('nope@example.test', 'Nope', now())`;
    const c = await m.getCampaign(id);
    expect(c?.stats.remaining).toBe(2); // timms and river
  });

  it("sends within the daily limit, once per person, then finishes", async () => {
    await adminSql`update mkt_campaigns set daily_limit = 1 where id = ${id}`;
    expect((await m.startCampaign(id)).ok).toBe(true);
    const first = await m.sendNextBatchNow(id);
    expect(first).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
    expect(await m.sendNextBatchNow(id)).toEqual({ ok: true, value: { sent: 0, failed: 0 } }); // today's limit reached
    await adminSql`update mkt_campaigns set daily_limit = 100 where id = ${id}`;
    expect(await m.sendNextBatchNow(id)).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
    await m.sendNextBatchNow(id);
    const [c] = await adminSql`select status from mkt_campaigns where id = ${id}`;
    expect(c.status).toBe("sent");
    const sends = await adminSql`select count(*)::int as n from mkt_sends where campaign_id = ${id}`;
    expect(sends[0].n).toBe(2);
    const [p] = await adminSql`select emails_sent from mkt_prospects where email = 'timms@example.test'`;
    expect(p.emails_sent).toBe(1);
  });

  it("follow-ups wait for the gap, then only go to people the first email reached", async () => {
    const [second] = await adminSql`select id from mkt_campaigns where follows_campaign_id = ${id}`;
    await m.sendTestEmail(second.id);
    expect((await m.startCampaign(second.id)).ok).toBe(true);
    expect(await m.sendNextBatchNow(second.id)).toEqual({ ok: true, value: { sent: 0, failed: 0 } }); // 3 days haven't passed
    await adminSql`update mkt_sends set sent_at = now() - interval '4 days' where campaign_id = ${id} and prospect_id = (select id from mkt_prospects where email = 'timms@example.test')`;
    expect(await m.sendNextBatchNow(second.id)).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
  });

  it("can't be edited while sending, and changing the words needs a new test", async () => {
    const [third] = await adminSql`select * from mkt_campaigns where delay_days = 4`;
    const input = {
      name: third.name, subject: "New subject", preheader: "", heading: "", body: third.body, buttonLabel: "", buttonUrl: "",
      audienceStyle: "all" as const, audienceSource: "", followsId: third.follows_campaign_id, delayDays: 4, dailyLimit: 100,
    };
    await m.sendTestEmail(third.id);
    expect((await m.saveCampaign(third.id, input)).ok).toBe(true);
    const [after] = await adminSql`select test_sent_at from mkt_campaigns where id = ${third.id}`;
    expect(after.test_sent_at).toBeNull();
    expect((await m.saveCampaign(id, { ...input, followsId: "" })).ok).toBe(false); // the first one has finished
  });

  it("only sends in UK weekday working hours from the hourly job", () => {
    expect(m.inSendingWindow(new Date("2026-11-16T10:00:00Z"))).toBe(true); // Monday 10am
    expect(m.inSendingWindow(new Date("2026-11-16T07:00:00Z"))).toBe(false); // Monday 7am
    expect(m.inSendingWindow(new Date("2026-11-15T12:00:00Z"))).toBe(false); // Sunday
    expect(m.inSendingWindow(new Date("2026-07-06T16:30:00Z"))).toBe(false); // Monday 5.30pm in summer time
  });
});

describe("unsubscribing", () => {
  it("works from the signed link, stops Library emails too, and rejects a forged link", async () => {
    const { signLink } = await import("@/lib/payments/crypto");
    const [p] = await adminSql`select id from mkt_prospects where email = 'timms@example.test'`;
    await adminSql`insert into crm_contacts (email, name, marketing_ok) values ('timms@example.test', 'Paul', true)`;
    expect(await m.marketingUnsubscribe("forged.token")).toBe(false);
    expect(await m.marketingUnsubscribe(signLink("mkt-unsub", { pr: p.id }, 3600))).toBe(true);
    const [after] = await adminSql`select status from mkt_prospects where id = ${p.id}`;
    expect(after.status).toBe("unsubscribed");
    const [crm] = await adminSql`select marketing_ok, unsubscribed_at from crm_contacts where email = 'timms@example.test'`;
    expect(crm.marketing_ok).toBe(false);
    expect(crm.unsubscribed_at).not.toBeNull();
  });
});
