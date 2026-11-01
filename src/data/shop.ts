import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { appUrl, sendEmail, templates } from "@/lib/email";
import type { FieldErrors, Result } from "./accounts";
import { accountFor, cardAccount, cardSessionPaid, startCardCheckout, validSessionId } from "./card";

/*
 * The club shop: uniforms, kit, gloves, anything the club sells. Families order from the club's shop page
 * (junbi.co.uk/c/<slug>/shop) and pay by card on the club's own Stripe, or pay at the club. Staff see the
 * orders and mark them handed over.
 */

const money = (p: number) => `£${(p / 100).toFixed(2)}`;

export async function clubBySlug(slug: unknown): Promise<{ clubId: string; clubName: string; published: boolean } | null> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const [r] = (await db().execute(sql`select * from club_by_slug(${slug})`)) as unknown as Array<{ club_id: string; club_name: string; published: boolean }>;
  return r ? { clubId: r.club_id, clubName: r.club_name, published: r.published } : null;
}

/* ---------- Staff ---------- */

const productSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(100),
  description: z.string().trim().max(500).optional(),
  price: z.string().trim().refine((v) => /^£?\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v.replace("£", "")) > 0, "Enter a price like 35 or 35.50."),
  options: z.string().trim().max(500).optional(),
});
export type ProductInput = z.input<typeof productSchema>;

const parseOptions = (v?: string) => [...new Set((v ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 30).map((x) => x.slice(0, 40));

function issues(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function listProducts(actor: Actor) {
  assertCan(actor, "payments.manage");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.select().from(s.products).orderBy(desc(s.products.active), asc(s.products.name)));
}

export async function saveProduct(actor: Actor, productId: string | null, input: ProductInput): Promise<Result<{ id: string }>> {
  assertCan(actor, "payments.manage");
  const p = productSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: issues(p.error) };
  const values = { name: p.data.name, description: p.data.description || null, pricePence: Math.round(Number(p.data.price.replace("£", "")) * 100), options: parseOptions(p.data.options) };
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    if (productId) {
      if (!z.string().uuid().safeParse(productId).success) return { ok: false as const, errors: { form: "Product not found." } };
      const done = await tx.update(s.products).set(values).where(eq(s.products.id, productId)).returning({ id: s.products.id });
      if (!done.length) return { ok: false as const, errors: { form: "Product not found." } };
      return { ok: true as const, value: { id: productId } };
    }
    const [row] = await tx.insert(s.products).values({ clubId: actor.clubId, ...values }).returning({ id: s.products.id });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "product", entityId: row.id, after: values });
    return { ok: true as const, value: { id: row.id } };
  });
}

export async function setProductActive(actor: Actor, productId: string, active: boolean) {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(productId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) => tx.update(s.products).set({ active }).where(eq(s.products.id, productId)));
}

/** Orders, newest first. Card pages that were never paid (after two hours) aren't shown. */
export async function listOrders(actor: Actor) {
  assertCan(actor, "payments.view");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select()
      .from(s.orders)
      .where(sql`not (${s.orders.status} = 'pending' and ${s.orders.createdAt} < now() - interval '2 hours')`)
      .orderBy(desc(s.orders.createdAt))
      .limit(200);
    const items = rows.length ? await tx.select().from(s.orderItems).where(inArray(s.orderItems.orderId, rows.map((r) => r.id))) : [];
    return rows.map((o) => ({
      ...o,
      total: money(o.totalPence),
      when: o.createdAt.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }),
      items: items.filter((i) => i.orderId === o.id).map((i) => `${i.quantity} × ${i.name}${i.option ? ` (${i.option})` : ""}`),
    }));
  });
}

export async function setOrderStatus(actor: Actor, orderId: string, change: "handed_over" | "cancelled" | "paid") {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(orderId).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const set = change === "paid" ? { paid: true, status: sql`case when ${s.orders.status} = 'to_pay' then 'paid' else ${s.orders.status} end` } : { status: change };
    await tx.update(s.orders).set(set).where(eq(s.orders.id, orderId));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "order", entityId: orderId, after: { change } });
  });
}

/* ---------- The family's shop page ---------- */

export type ShopPage = {
  clubName: string;
  card: boolean;
  products: Array<{ id: string; name: string; description: string | null; pricePence: number; options: string[] }>;
};

export async function shopPage(slug: unknown): Promise<ShopPage | null> {
  const club = await clubBySlug(slug);
  if (!club) return null;
  return withClub({ clubId: club.clubId }, async (tx) => {
    const products = await tx
      .select({ id: s.products.id, name: s.products.name, description: s.products.description, pricePence: s.products.pricePence, options: s.products.options })
      .from(s.products)
      .where(eq(s.products.active, true))
      .orderBy(asc(s.products.name));
    if (!products.length) return null;
    return { clubName: club.clubName, card: Boolean(await cardAccount(tx)), products };
  });
}

const orderSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter your email so the club can confirm your order.").max(200),
  phone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), option: z.string().max(40).optional(), quantity: z.number().int().min(1).max(50) })).max(40),
});
export type OrderInput = z.input<typeof orderSchema>;

async function notifyStaff(clubId: string, orderId: string) {
  const detail = await withClub({ clubId }, async (tx) => {
    const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId));
    const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, clubId));
    const staff = (await tx.execute(sql`select u.email from club_staff cs join users u on u.id = cs.user_id where cs.role in ('owner', 'admin')`)) as unknown as Array<{ email: string }>;
    return { o, items, club: club.name, staff: staff.map((x) => x.email) };
  });
  if (!detail.o) return;
  const lines = detail.items.map((i) => `${i.quantity} × ${i.name}${i.option ? ` (${i.option})` : ""}`);
  const url = await appUrl();
  const forBuyer = templates.orderConfirm(detail.o.name, detail.club, lines, money(detail.o.totalPence), detail.o.paid);
  const forStaff = templates.newOrder(detail.club, detail.o.name, lines, money(detail.o.totalPence), detail.o.paid, `${url}/shop`);
  await Promise.allSettled([
    sendEmail({ to: detail.o.email, ...forBuyer, template: "order-confirm", clubId, dedupeKey: `order-confirm:${orderId}:${detail.o.paid}` }),
    ...detail.staff.map((to) => sendEmail({ to, ...forStaff, template: "new-order", clubId, dedupeKey: `new-order:${orderId}:${to}` })),
  ]);
}

/** Places an order. With card payments on: returns the Stripe page. Otherwise: confirmed to pay at the club. */
export async function submitOrder(slug: unknown, input: OrderInput): Promise<Result<{ url: string | null; orderId: string }>> {
  const club = await clubBySlug(slug);
  if (!club) return { ok: false, errors: { form: "This shop isn't open." } };
  const p = orderSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: issues(p.error) };
  const d = p.data;
  if (!d.items.length) return { ok: false, errors: { form: "Add something to your order." } };
  const made = await withClub({ clubId: club.clubId }, async (tx) => {
    const products = await tx.select().from(s.products).where(and(inArray(s.products.id, d.items.map((i) => i.productId)), eq(s.products.active, true)));
    const lines = [];
    for (const i of d.items) {
      const prod = products.find((x) => x.id === i.productId);
      if (!prod) return { error: "Something in your order is no longer for sale. Please refresh the page." };
      if (prod.options.length && !(i.option && prod.options.includes(i.option))) return { error: `Choose a size or option for ${prod.name}.` };
      lines.push({ product: prod, option: prod.options.length ? i.option! : null, quantity: i.quantity });
    }
    const total = lines.reduce((n, l) => n + l.product.pricePence * l.quantity, 0);
    const [g] = (await tx.execute(sql`select household_id from guardians where lower(email) = ${d.email} order by created_at limit 1`)) as unknown as Array<{ household_id: string }>;
    const account = await cardAccount(tx);
    const [o] = await tx
      .insert(s.orders)
      .values({ clubId: club.clubId, householdId: g?.household_id ?? null, name: d.name, email: d.email, phone: d.phone || null, note: d.note || null, totalPence: total, status: account ? "pending" : "to_pay" })
      .returning({ id: s.orders.id });
    await tx.insert(s.orderItems).values(lines.map((l) => ({ clubId: club.clubId, orderId: o.id, productId: l.product.id, name: l.product.name, option: l.option, quantity: l.quantity, unitPence: l.product.pricePence })));
    return { orderId: o.id, account, lines };
  });
  if ("error" in made) return { ok: false, errors: { form: made.error! } };
  if (!made.account) {
    await notifyStaff(club.clubId, made.orderId);
    return { ok: true, value: { url: null, orderId: made.orderId } };
  }
  const base = await appUrl();
  try {
    const session = await startCardCheckout(made.account, {
      lines: made.lines.map((l) => ({ name: `${l.product.name}${l.option ? ` (${l.option})` : ""}`, unitPence: l.product.pricePence, quantity: l.quantity })),
      email: d.email,
      successUrl: `${base}/c/${slug}/shop/done?session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/c/${slug}/shop`,
      metadata: { junbi_order: made.orderId },
      description: `${club.clubName} shop order`,
      fakeKey: made.orderId,
    });
    await withClub({ clubId: club.clubId }, (tx) => tx.update(s.orders).set({ checkoutRef: session.id }).where(eq(s.orders.id, made.orderId)));
    return { ok: true, value: { url: session.url, orderId: made.orderId } };
  } catch (err) {
    console.error("Starting shop card payment failed", err);
    await withClub({ clubId: club.clubId }, (tx) => tx.update(s.orders).set({ status: "cancelled" }).where(eq(s.orders.id, made.orderId)));
    return { ok: false, errors: { form: "We couldn't open the card payment page. Please try again in a minute." } };
  }
}

/** Marks a shop order paid once Stripe says so (webhook or the page they come back to). Safe to call twice. */
export async function confirmOrderPayment(clubId: string, sessionId: string): Promise<boolean> {
  if (!validSessionId(sessionId)) return false;
  const account = await withClub({ clubId }, accountFor);
  if (!account || !(await cardSessionPaid(account, sessionId))) return false;
  const done = await withClub({ clubId }, (tx) =>
    tx
      .update(s.orders)
      .set({ status: "paid", paid: true })
      .where(and(eq(s.orders.checkoutRef, sessionId), inArray(s.orders.status, ["pending", "cancelled"])))
      .returning({ id: s.orders.id }),
  );
  if (done.length) await notifyStaff(clubId, done[0].id);
  return done.length > 0;
}

export async function orderDone(slug: unknown, sessionId: string | undefined) {
  const club = await clubBySlug(slug);
  if (!club || !sessionId || !validSessionId(sessionId)) return club ? { clubName: club.clubName, paid: false } : null;
  await confirmOrderPayment(club.clubId, sessionId).catch((err) => console.error("confirming shop payment failed", err));
  const [o] = await withClub({ clubId: club.clubId }, (tx) => tx.select({ paid: s.orders.paid }).from(s.orders).where(eq(s.orders.checkoutRef, sessionId)));
  return { clubName: club.clubName, paid: Boolean(o?.paid) };
}
