import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { appUrl, libraryEmail, sendEmail } from "@/lib/email";
import { signLink, verifyLink } from "@/lib/payments/crypto";
import { ARTS, ROLES, SIZES, SYSTEMS, formatPrice, type Ebook } from "@/lib/ebooks";
import { allEbooks, shopEbooks } from "./library";
import type { Result } from "./accounts";

/*
 * The Junbi Library and CRM. People order ebooks (free, or paid by card) through a checkout; each order adds or updates a
 * contact in the CRM on the Junbi admin page. If they say yes to emails, three follow-ups go out over the
 * next nine days, stopping if they sign up or unsubscribe. These tables belong to Junbi, not to a club.
 */

const DAY = 86_400_000;
const ORDER_TTL = 60 * 60 * 24 * 365; // order page and download links work for a year
const UNSUB_TTL = 60 * 60 * 24 * 365 * 5;

export const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "demo", label: "Demo booked" },
  { key: "trial", label: "On trial" },
  { key: "customer", label: "Customer" },
  { key: "not_interested", label: "Not interested" },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
const STAGE_KEYS = STAGES.map((s) => s.key) as [Stage, ...Stage[]];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

/** After each follow-up, how long until the next (step 1 goes 2 days after the order). */
const FOLLOWUP_GAPS = [2 * DAY, 3 * DAY, 4 * DAY];

const text = (max: number) => z.string().trim().max(max);
/** A text[] parameter (drizzle would otherwise spread a JS array into a list). */
const textArray = (a: string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(a)}::jsonb))::text[]`;
const orderSchema = z.object({
  name: text(100).min(1, "Enter your name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  clubName: text(120),
  role: z.enum(ROLES, { message: "Choose what best describes you." }),
  arts: z.array(z.enum(ARTS)).max(ARTS.length),
  size: z.enum(SIZES, { message: "Choose your club size." }),
  system: z.enum(SYSTEMS, { message: "Choose what you use now." }),
  items: z.array(z.string().max(60)).min(1, "Choose at least one ebook.").max(30),
  marketingOk: z.boolean(),
});
export type OrderInput = z.input<typeof orderSchema>;

const urls = async () => {
  const base = await appUrl();
  return {
    order: (orderId: string) => `${base}/library/order/${signLink("library-order", { o: orderId }, ORDER_TTL)}`,
    download: (orderId: string, slug: string) => `${base}/api/library/download?t=${encodeURIComponent(signLink("library-dl", { o: orderId, b: slug }, ORDER_TTL))}`,
    unsubscribe: (contactId: string) => `${base}/library/unsubscribe?t=${encodeURIComponent(signLink("library-unsub", { c: contactId }, UNSUB_TTL))}`,
    book: (slug: string) => `${base}/library/${slug}`,
    signup: `${base}/signup`,
  };
};

const titles = (books: Ebook[]) => (books.length === 1 ? books[0].title : `${books.slice(0, -1).map((b) => b.title).join(", ")} and ${books[books.length - 1].title}`);

/* ---------- Public: the checkout ---------- */

/** All ebooks by slug, drafts included (so old orders still show their titles). */
const bookMap = async () => new Map((await allEbooks()).map((b) => [b.slug, b]));
const title = (m: Map<string, Ebook>, slug: string) => m.get(slug)?.title ?? slug;

/**
 * Places an order. Free orders are confirmed straight away. Orders with a price go to Stripe (Junbi's
 * account) and are confirmed when the payment comes back. Either way the buyer is added to the CRM now.
 */
export async function placeLibraryOrder(raw: OrderInput, opts: { cancelUrl?: string } = {}): Promise<Result<{ token: string; number: number; payUrl: string | null }>> {
  const p = orderSchema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  const shop = await shopEbooks();
  const books = [...new Set(d.items)].map((s) => shop.find((b) => b.slug === s)).filter((b): b is Ebook => Boolean(b));
  if (!books.length) return { ok: false, errors: { items: "Choose at least one ebook." } };
  if (d.role !== "Thinking of starting a club" && !d.clubName) return { ok: false, errors: { clubName: "Enter your club's name." } };
  const total = books.reduce((a, b) => a + b.pricePence, 0);
  if (total > 0 && !process.env.STRIPE_SECRET_KEY && process.env.PAYMENTS_FAKE !== "1") {
    return { ok: false, errors: { form: "Card payments aren't switched on yet. Untick the paid ebooks, or try again later." } };
  }

  const [c] = (await db().execute(sql`
    insert into crm_contacts (email, name, club_name, role, arts, size_band, current_system, marketing_ok, followup_due_at)
    values (${d.email}, ${d.name}, ${d.clubName}, ${d.role}, ${textArray(d.arts)}, ${d.size}, ${d.system}, ${d.marketingOk},
            ${d.marketingOk ? new Date(Date.now() + FOLLOWUP_GAPS[0]).toISOString() : null}::timestamptz)
    on conflict (email) do update set
      name = excluded.name,
      club_name = coalesce(nullif(excluded.club_name, ''), crm_contacts.club_name),
      role = excluded.role,
      arts = case when cardinality(excluded.arts) > 0 then excluded.arts else crm_contacts.arts end,
      size_band = excluded.size_band,
      current_system = excluded.current_system,
      marketing_ok = crm_contacts.marketing_ok or excluded.marketing_ok,
      unsubscribed_at = case when excluded.marketing_ok then null else crm_contacts.unsubscribed_at end,
      followup_due_at = case
        when excluded.marketing_ok and crm_contacts.followup_step = 0 and crm_contacts.followup_due_at is null and crm_contacts.signed_up_club is null
          then excluded.followup_due_at
        else crm_contacts.followup_due_at end,
      updated_at = now(), last_activity_at = now()
    returning id`)) as unknown as Array<{ id: string }>;

  const slugs = books.map((b) => b.slug);
  const [o] = (await db().execute(sql`
    insert into crm_orders (contact_id, items, amount_pence, status) values (${c.id}::uuid, ${textArray(slugs)}, ${total}, ${total > 0 ? "pending" : "free"})
    returning id, number`)) as unknown as Array<{ id: string; number: number }>;
  await event(c.id, "order", `${total > 0 ? "Started checkout for" : "Ordered"} ${titles(books)} (order ${o.number}${total > 0 ? `, ${formatPrice(total)}` : ""})${d.marketingOk ? ", said yes to emails" : ""}`);
  const token = signLink("library-order", { o: o.id }, ORDER_TTL);

  if (total === 0) {
    await confirmOrder(o.id);
    return { ok: true, value: { token, number: o.number, payUrl: null } };
  }

  const base = await appUrl();
  const successUrl = `${base}/library/order/${token}?paid={CHECKOUT_SESSION_ID}`;
  let session: { id: string; url: string };
  if (process.env.PAYMENTS_FAKE === "1") {
    session = { id: `cs_fake_${o.id}`, url: successUrl.replace("{CHECKOUT_SESSION_ID}", `cs_fake_${o.id}`) };
  } else {
    const { stripeApi } = await import("@/lib/payments/stripe");
    const meta = { junbi_library_order: o.id };
    session = await stripeApi<{ id: string; url: string }>("POST", "/checkout/sessions", {
      mode: "payment",
      customer_email: d.email,
      line_items: books.filter((b) => b.pricePence > 0).map((b) => ({ quantity: 1, price_data: { currency: "gbp", unit_amount: b.pricePence, product_data: { name: `${b.title} (ebook)`.slice(0, 250) } } })),
      success_url: successUrl,
      cancel_url: opts.cancelUrl ?? `${base}/library/checkout?items=${slugs.join(",")}`,
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `Junbi Library order ${o.number}` },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }, undefined, `library-order-${o.id}`);
  }
  await db().execute(sql`update crm_orders set stripe_session = ${session.id} where id = ${o.id}::uuid`);
  return { ok: true, value: { token, number: o.number, payUrl: session.url } };
}

/** Sends the confirmation email for an order that's free or paid, and records what was delivered. Runs once per order. */
async function confirmOrder(orderId: string) {
  const [r] = (await db().execute(sql`
    select o.number, o.items, o.amount_pence, o.status, c.id as contact_id, c.name, c.email from crm_orders o join crm_contacts c on c.id = o.contact_id where o.id = ${orderId}::uuid`)) as unknown as Array<{ number: number; items: string[]; amount_pence: number; status: string; contact_id: string; name: string; email: string }>;
  if (!r || r.status === "pending") return;
  const m = await bookMap();
  const books = r.items.map((s) => m.get(s)).filter((b): b is Ebook => Boolean(b));
  const ready = books.filter((b) => b.ready);
  const waiting = books.filter((b) => !b.ready);
  const u = await urls();
  const lines = [
    `Hi ${r.name.split(/\s+/)[0]},`,
    ready.length ? `Thanks for your order. ${titles(ready)} ${ready.length === 1 ? "is" : "are"} ready to download now. The link works for a year.` : "Thanks for your order.",
    ...(waiting.length ? [`${titles(waiting)} ${waiting.length === 1 ? "isn't" : "aren't"} quite finished. We'll email ${waiting.length === 1 ? "it" : "them"} to you the day ${waiting.length === 1 ? "it's" : "they're"} out.`] : []),
    `Total paid: ${r.amount_pence ? `£${(r.amount_pence / 100).toFixed(2)}` : "£0.00"}. Enjoy.`,
  ];
  const e = libraryEmail(`Your Junbi order ${r.number}`, "Your order is confirmed.", lines, { label: ready.length ? "Download your ebooks" : "See your order", url: u.order(orderId) });
  const sent = await sendEmail({ to: r.email, subject: e.subject, html: e.html, text: e.text, template: "library-order", dedupeKey: `library-order:${orderId}` });
  if (sent.status === "skipped") return;
  for (const b of ready) await event(r.contact_id, "delivered", b.slug);
}

/** Marks a card order paid once Stripe says so (from the webhook or the return page). Safe to call twice. */
export async function markLibraryOrderPaid(orderId: string, sessionId: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(orderId).success || !/^cs_[A-Za-z0-9_-]{1,200}$/.test(sessionId)) return false;
  const [o] = (await db().execute(sql`select status, stripe_session, contact_id, number, amount_pence from crm_orders where id = ${orderId}::uuid`)) as unknown as Array<{ status: string; stripe_session: string | null; contact_id: string; number: number; amount_pence: number }>;
  if (!o || o.stripe_session !== sessionId) return false;
  if (o.status === "paid") return true;
  let paid = process.env.PAYMENTS_FAKE === "1" && sessionId.startsWith("cs_fake_");
  if (!paid) {
    const { stripeApi } = await import("@/lib/payments/stripe");
    const s = await stripeApi<{ payment_status: string; metadata?: { junbi_library_order?: string } }>("GET", `/checkout/sessions/${sessionId}`, null).catch(() => null);
    paid = s?.payment_status === "paid" && s.metadata?.junbi_library_order === orderId;
  }
  if (!paid) return false;
  const rows = (await db().execute(sql`update crm_orders set status = 'paid', paid_at = now() where id = ${orderId}::uuid and status = 'pending' returning id`)) as unknown as Array<{ id: string }>;
  if (rows.length) {
    await event(o.contact_id, "paid", `Paid £${(o.amount_pence / 100).toFixed(2)} for order ${o.number}`);
    await confirmOrder(orderId);
  }
  return true;
}

/** The order page. With ?paid=..., checks the payment first so people don't wait for the webhook. */
export async function libraryOrder(token: unknown, paidSession?: string) {
  const v = verifyLink<{ o: string }>("library-order", token);
  if (!v || !z.string().uuid().safeParse(v.o).success) return null;
  if (paidSession) await markLibraryOrderPaid(v.o, paidSession).catch(() => false);
  const [r] = (await db().execute(sql`select o.number, o.items, o.amount_pence, o.status, c.name, c.email from crm_orders o join crm_contacts c on c.id = o.contact_id where o.id = ${v.o}::uuid`)) as unknown as Array<{ number: number; items: string[]; amount_pence: number; status: string; name: string; email: string }>;
  if (!r) return null;
  const u = await urls();
  const m = await bookMap();
  const confirmed = r.status !== "pending";
  return {
    number: r.number,
    firstName: r.name.split(/\s+/)[0],
    email: r.email,
    amountPence: r.amount_pence,
    status: r.status as "free" | "pending" | "paid",
    items: r.items.map((s) => m.get(s)).filter((b): b is Ebook => Boolean(b)).map((b) => ({ book: b, downloadUrl: confirmed && b.ready ? u.download(v.o, b.slug) : null })),
  };
}

/** Checks a download link (tied to a confirmed order) and records the download. Returns the ebook to send. */
export async function libraryDownload(token: unknown): Promise<Ebook | null> {
  const v = verifyLink<{ o: string; b: string }>("library-dl", token);
  if (!v || !z.string().uuid().safeParse(v.o).success) return null;
  const [o] = (await db().execute(sql`select contact_id from crm_orders where id = ${v.o}::uuid and status in ('free', 'paid') and ${v.b} = any(items)`)) as unknown as Array<{ contact_id: string }>;
  const book = o ? (await bookMap()).get(v.b) : null;
  if (!o || !book || !book.pdf || book.status === "draft") return null;
  await event(o.contact_id, "download", book.slug).catch(() => {});
  return book;
}

/** From the link in every follow-up email. */
export async function libraryUnsubscribe(token: unknown): Promise<boolean> {
  const v = verifyLink<{ c: string }>("library-unsub", token);
  if (!v || !z.string().uuid().safeParse(v.c).success) return false;
  const rows = (await db().execute(sql`
    update crm_contacts set marketing_ok = false, unsubscribed_at = coalesce(unsubscribed_at, now()), followup_due_at = null, updated_at = now()
    where id = ${v.c}::uuid returning id`)) as unknown as Array<{ id: string }>;
  if (rows.length) await event(v.c, "unsubscribe", "Unsubscribed from emails");
  return rows.length > 0;
}

/** When a club signs up, its owner's contact moves to "On trial" and the follow-ups stop. */
export async function linkSignupToCrm(email: string, clubId: string, clubName: string) {
  const rows = (await db().execute(sql`
    update crm_contacts set signed_up_club = ${clubId}::uuid, followup_due_at = null,
      stage = case when stage in ('new', 'contacted', 'demo') then 'trial' else stage end,
      club_name = coalesce(nullif(club_name, ''), ${clubName}), updated_at = now(), last_activity_at = now()
    where email = ${email.trim().toLowerCase()} returning id`)) as unknown as Array<{ id: string }>;
  for (const r of rows) await event(r.id, "signup", `Signed up to Junbi as ${clubName}`);
}

/* ---------- Follow-up emails (hourly) ---------- */

type Due = { id: string; email: string; name: string; followup_step: number; ordered: string[] };

/** Sends any follow-up emails that are due. Safe to run twice: each step only goes once per contact. */
export async function sendLibraryFollowups() {
  const due = (await db().execute(sql`
    select c.id, c.email, c.name, c.followup_step,
      coalesce((select array_agg(distinct i) from crm_orders o, unnest(o.items) i where o.contact_id = c.id), '{}') as ordered
    from crm_contacts c
    where c.followup_due_at <= now() and c.marketing_ok and c.unsubscribed_at is null and c.signed_up_club is null
      and c.stage not in ('customer', 'not_interested') and c.followup_step < ${FOLLOWUP_GAPS.length}
    order by c.followup_due_at limit 100`)) as unknown as Due[];
  const u = await urls();
  const m = await bookMap();
  const shop = await shopEbooks();
  let sent = 0;
  for (const c of due) {
    const step = c.followup_step + 1;
    const first = c.name.split(/\s+/)[0] || "there";
    const had = c.ordered.map((s) => m.get(s)).filter((b): b is Ebook => Boolean(b));
    const next = shop.find((b) => !c.ordered.includes(b.slug) && b.pricePence === 0) ?? shop.find((b) => !c.ordered.includes(b.slug));
    const tipBook = had.find((b) => b.tip.body) ?? shop.find((b) => b.tip.body);
    let e;
    if (step === 1 && tipBook) {
      e = libraryEmail(tipBook.tip.heading || "A quick idea for this week", tipBook.tip.heading || "A quick idea for this week", [`Hi ${first},`, `One quick idea from ${tipBook.title} that's worth trying this week:`, tipBook.tip.body, "If it helps, reply and tell me how it goes. I read every reply."], undefined, u.unsubscribe(c.id));
    } else if (step === 2 && next) {
      const free = next.pricePence === 0;
      e = libraryEmail(free ? `Another free one: ${next.title}` : `You might like ${next.title}`, free ? "Another free one for you." : `You might like ${next.title}.`, [`Hi ${first},`, `Since you got ${had.length ? titles(had) : "one of our ebooks"}, you might like ${next.title}: ${next.pitch}`, ...(free ? ["It's free as well, same as before."] : [])], { label: free ? `Get ${next.title} for £0` : `See ${next.title}`, url: u.book(next.slug) }, u.unsubscribe(c.id));
    } else {
      e = libraryEmail("Less admin, more training", "Less admin. More training.", [`Hi ${first},`, "Junbi runs the admin side of a martial arts club: students and families, registers on your phone, Direct Debit through your own Stripe or GoCardless, and messages to parents.", "It's one flat price from £19 a month, and we never take a percentage of your fees. Try it free for 7 days."], { label: "Start your free trial", url: u.signup }, u.unsubscribe(c.id));
    }
    const r = await sendEmail({ to: c.email, subject: e.subject, html: e.html, text: e.text, template: `library-followup-${step}`, dedupeKey: `library-followup:${c.id}:${step}` });
    const gap = FOLLOWUP_GAPS[step];
    await db().execute(sql`update crm_contacts set followup_step = ${step}, followup_due_at = ${gap ? new Date(Date.now() + gap).toISOString() : null}::timestamptz, updated_at = now() where id = ${c.id}::uuid`);
    if (r.status !== "skipped") {
      await event(c.id, "email", `Follow-up ${step}: ${e.subject}`);
      sent++;
    }
  }
  return { due: due.length, sent };
}

/* ---------- Admin ---------- */

async function event(contactId: string, kind: string, detail: string, by: string | null = null) {
  await db().execute(sql`insert into crm_events (contact_id, kind, detail, by_whom) values (${contactId}::uuid, ${kind}, ${detail}, ${by})`);
}

type ContactRow = {
  id: string; email: string; name: string; club_name: string; role: string; arts: string[]; size_band: string; current_system: string; phone: string;
  source: string; stage: Stage; next_action_on: string | null; marketing_ok: boolean; unsubscribed_at: Date | null; followup_step: number;
  signed_up_club: string | null; created_at: Date; last_activity_at: Date; ordered: string[];
};

const contactCols = sql`c.id, c.email, c.name, c.club_name, c.role, c.arts, c.size_band, c.current_system, c.phone, c.source, c.stage,
  to_char(c.next_action_on, 'YYYY-MM-DD') as next_action_on, c.marketing_ok, c.unsubscribed_at, c.followup_step, c.signed_up_club, c.created_at, c.last_activity_at,
  coalesce((select array_agg(distinct i) from crm_orders o, unnest(o.items) i where o.contact_id = c.id), '{}') as ordered`;

const shape = (r: ContactRow) => ({
  id: r.id, email: r.email, name: r.name, clubName: r.club_name, role: r.role, arts: r.arts, size: r.size_band, system: r.current_system, phone: r.phone,
  source: r.source, stage: r.stage, nextActionOn: r.next_action_on, marketingOk: r.marketing_ok, unsubscribed: Boolean(r.unsubscribed_at),
  followupStep: r.followup_step, signedUp: Boolean(r.signed_up_club), createdAt: new Date(r.created_at), lastActivity: new Date(r.last_activity_at), ordered: r.ordered,
});
export type CrmContact = ReturnType<typeof shape>;

/** The CRM list, newest activity first, with counts for the stage tabs and library numbers. */
export async function crmOverview(f: { q?: string; stage?: string; book?: string; source?: string } = {}) {
  await requireSuperAdmin();
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 100);
  const stage = STAGE_KEYS.includes(f.stage as Stage) ? f.stage : null;
  const all = await allEbooks();
  const book = all.find((b) => b.slug === f.book)?.slug ?? null;
  const source = f.source === "elite" ? "elite" : null;
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const rows = (await db().execute(sql`
    select ${contactCols} from crm_contacts c
    where (${stage}::text is null or c.stage = ${stage})
      and (${q} = '' or lower(c.email) like ${like} or lower(c.name) like ${like} or lower(c.club_name) like ${like})
      and (${source}::text is null or c.source = ${source})
      and (${book}::text is null or exists (select 1 from crm_orders o where o.contact_id = c.id and ${book} = any(o.items)))
    order by c.next_action_on asc nulls last, c.last_activity_at desc limit 500`)) as unknown as ContactRow[];
  const [counts] = (await db().execute(sql`
    select count(*)::int as total,
      count(*) filter (where created_at > now() - interval '7 days')::int as week,
      count(*) filter (where marketing_ok and unsubscribed_at is null)::int as emails_ok,
      count(*) filter (where signed_up_club is not null)::int as signed_up,
      count(*) filter (where next_action_on <= current_date and stage not in ('customer', 'not_interested'))::int as due,
      count(*) filter (where source = 'elite')::int as elite
    from crm_contacts`)) as unknown as Array<{ total: number; week: number; emails_ok: number; signed_up: number; due: number; elite: number }>;
  const byStage = (await db().execute(sql`select stage, count(*)::int as n from crm_contacts group by stage`)) as unknown as Array<{ stage: string; n: number }>;
  const byBook = (await db().execute(sql`
    select i as slug, count(distinct o.contact_id)::int as people,
      count(distinct o.contact_id) filter (where o.status in ('free', 'paid') and not exists (select 1 from crm_events e where e.contact_id = o.contact_id and e.kind = 'delivered' and e.detail = i))::int as waiting,
      (select count(*)::int from crm_events e where e.kind = 'download' and e.detail = i) as downloads
    from crm_orders o, unnest(o.items) i group by i`)) as unknown as Array<{ slug: string; people: number; waiting: number; downloads: number }>;
  return {
    contacts: rows.map(shape),
    counts: { total: counts?.total ?? 0, week: counts?.week ?? 0, emailsOk: counts?.emails_ok ?? 0, signedUp: counts?.signed_up ?? 0, due: counts?.due ?? 0, elite: counts?.elite ?? 0 },
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r.n])) as Record<string, number>,
    books: all.map((b) => ({ book: b, ...(byBook.find((x) => x.slug === b.slug) ?? { people: 0, waiting: 0, downloads: 0 }) })),
  };
}

/** One contact with their timeline and orders. */
export async function crmContact(id: string) {
  await requireSuperAdmin();
  if (!z.string().uuid().safeParse(id).success) return null;
  const [r] = (await db().execute(sql`select ${contactCols} from crm_contacts c where c.id = ${id}::uuid`)) as unknown as ContactRow[];
  if (!r) return null;
  const events = (await db().execute(sql`select id, kind, detail, by_whom, created_at from crm_events where contact_id = ${id}::uuid order by created_at desc limit 200`)) as unknown as Array<{ id: string; kind: string; detail: string; by_whom: string | null; created_at: Date }>;
  const orders = (await db().execute(sql`select number, items, amount_pence, status, created_at from crm_orders where contact_id = ${id}::uuid order by created_at desc`)) as unknown as Array<{ number: number; items: string[]; amount_pence: number; status: string; created_at: Date }>;
  const m = await bookMap();
  return {
    contact: shape(r),
    events: events.map((e) => ({ id: e.id, kind: e.kind, detail: e.kind === "delivered" || e.kind === "download" ? `${e.kind === "delivered" ? "Sent" : "Downloaded"} ${title(m, e.detail)}` : e.detail, by: e.by_whom, at: new Date(e.created_at) })),
    orders: orders.map((o) => ({ number: o.number, items: o.items.map((s) => title(m, s)), amountPence: o.amount_pence, status: o.status, at: new Date(o.created_at) })),
    titles: Object.fromEntries([...m].map(([k, b]) => [k, b.title])) as Record<string, string>,
  };
}

const updateSchema = z.object({
  stage: z.enum(STAGE_KEYS),
  nextActionOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  name: text(100),
  clubName: text(120),
  phone: text(40),
});

export async function crmUpdate(id: string, raw: z.input<typeof updateSchema>): Promise<Result> {
  const admin = await requireSuperAdmin();
  const p = updateSchema.safeParse(raw);
  if (!p.success || !z.string().uuid().safeParse(id).success) return { ok: false, errors: { form: "Check the details and try again." } };
  const d = p.data;
  const [before] = (await db().execute(sql`select stage, to_char(next_action_on, 'YYYY-MM-DD') as next_action_on from crm_contacts where id = ${id}::uuid`)) as unknown as Array<{ stage: string; next_action_on: string | null }>;
  if (!before) return { ok: false, errors: { form: "That contact no longer exists." } };
  await db().execute(sql`
    update crm_contacts set stage = ${d.stage}, next_action_on = ${d.nextActionOn || null}::date, name = ${d.name}, club_name = ${d.clubName}, phone = ${d.phone},
      followup_due_at = case when ${d.stage} in ('customer', 'not_interested') then null else followup_due_at end,
      updated_at = now(), last_activity_at = now()
    where id = ${id}::uuid`);
  if (before.stage !== d.stage) await event(id, "stage", `${stageLabel(before.stage)} → ${stageLabel(d.stage)}`, admin.email);
  if ((before.next_action_on ?? "") !== d.nextActionOn) await event(id, "edit", d.nextActionOn ? `Next follow-up set for ${d.nextActionOn}` : "Next follow-up cleared", admin.email);
  return { ok: true, value: undefined };
}

export async function crmAddNote(id: string, note: string): Promise<Result> {
  const admin = await requireSuperAdmin();
  const n = note.trim().slice(0, 4000);
  if (!n || !z.string().uuid().safeParse(id).success) return { ok: false, errors: { note: "Write a note first." } };
  await event(id, "note", n, admin.email);
  await db().execute(sql`update crm_contacts set last_activity_at = now() where id = ${id}::uuid`);
  return { ok: true, value: undefined };
}

/** Adds someone by hand (met at an event, a phone call). */
export async function crmAddContact(raw: { name: string; email: string; clubName: string; phone: string }): Promise<Result<{ id: string }>> {
  const admin = await requireSuperAdmin();
  const p = z.object({ name: text(100).min(1, "Enter a name."), email: z.string().trim().toLowerCase().email("Enter a valid email address."), clubName: text(120), phone: text(40) }).safeParse(raw);
  if (!p.success) return { ok: false, errors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const rows = (await db().execute(sql`
    insert into crm_contacts (email, name, club_name, phone, source) values (${p.data.email}, ${p.data.name}, ${p.data.clubName}, ${p.data.phone}, 'manual')
    on conflict (email) do nothing returning id`)) as unknown as Array<{ id: string }>;
  if (!rows.length) return { ok: false, errors: { email: "That email is already in the CRM." } };
  await event(rows[0].id, "note", "Added by hand", admin.email);
  return { ok: true, value: { id: rows[0].id } };
}

/** Sends a finished ebook to everyone who pre-ordered it. Each person only gets it once. */
export async function deliverEbook(slug: string): Promise<Result<{ sent: number }>> {
  await requireSuperAdmin();
  const book = (await bookMap()).get(slug);
  if (!book) return { ok: false, errors: { form: "Unknown ebook." } };
  if (!book.ready) return { ok: false, errors: { form: `${book.title} isn't live yet. Upload the PDF and set it to Live first.` } };
  const waiting = (await db().execute(sql`
    select distinct on (c.id) c.id, c.email, c.name, o.id as order_id from crm_orders o join crm_contacts c on c.id = o.contact_id
    where ${slug} = any(o.items) and o.status in ('free', 'paid')
      and not exists (select 1 from crm_events e where e.contact_id = c.id and e.kind = 'delivered' and e.detail = ${slug})
    order by c.id, o.created_at`)) as unknown as Array<{ id: string; email: string; name: string; order_id: string }>;
  const u = await urls();
  for (const c of waiting) {
    const e = libraryEmail(`${book.title} is ready`, `${book.title} is ready.`, [`Hi ${c.name.split(/\s+/)[0] || "there"},`, `You ordered ${book.title} from the Junbi Library, and it's finished. Here it is, as promised.`], { label: "Download it", url: u.download(c.order_id, slug) });
    await sendEmail({ to: c.email, subject: e.subject, html: e.html, text: e.text, template: "library-ready", dedupeKey: `library-ready:${c.id}:${slug}` });
    await event(c.id, "delivered", slug);
  }
  return { ok: true, value: { sent: waiting.length } };
}

/** Everyone in the CRM as a CSV file. */
export async function crmCsv(): Promise<string> {
  await requireSuperAdmin();
  const rows = (await db().execute(sql`select ${contactCols} from crm_contacts c order by c.created_at`)) as unknown as ContactRow[];
  const m = await bookMap();
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v instanceof Date ? v.toISOString() : String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // stop spreadsheets running formulas
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Name", "Email", "Club", "Role", "Arts", "Size", "Current system", "Phone", "Stage", "Next follow-up", "Emails OK", "Ebooks", "Signed up", "Added", "Last activity"];
  const body = rows.map(shape).map((c) => [c.name, c.email, c.clubName, c.role, c.arts, c.size, c.system, c.phone, stageLabel(c.stage), c.nextActionOn ?? "", c.marketingOk && !c.unsubscribed ? "Yes" : "No", c.ordered.map((s) => title(m, s)), c.signedUp ? "Yes" : "No", c.createdAt, c.lastActivity].map(cell).join(","));
  return [head.join(","), ...body].join("\n");
}
