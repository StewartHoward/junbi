import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { allEbooks } from "./library";

/*
 * The Shop dashboard on the Junbi admin page: Library orders, money taken and what's selling.
 * A card order that hasn't been paid an hour after checkout counts as abandoned.
 */

export type OrderStatus = "free" | "paid" | "pending" | "abandoned";
export const ORDER_LABEL: Record<OrderStatus, string> = { paid: "Paid", free: "Free", pending: "Awaiting payment", abandoned: "Abandoned" };
const ABANDON = sql`interval '1 hour'`;
const statusExpr = sql`case when o.status = 'pending' and o.created_at < now() - ${ABANDON} then 'abandoned' else o.status end`;

type OrderRow = { id: string; number: number; items: string[]; amount_pence: number; status: OrderStatus; created_at: Date; paid_at: Date | null; contact_id: string; name: string; email: string; club_name: string; downloads: number };

export async function shopDashboard() {
  await requireSuperAdmin();
  const books = await allEbooks();
  const title = (s: string) => books.find((b) => b.slug === s)?.title ?? s;
  try {
    const [k] = (await db().execute(sql`
      select
        count(*) filter (where o.status in ('free', 'paid'))::int as orders,
        count(*) filter (where o.status in ('free', 'paid') and o.created_at >= current_date)::int as today,
        count(*) filter (where o.status in ('free', 'paid') and o.created_at > now() - interval '7 days')::int as week,
        count(*) filter (where o.status in ('free', 'paid') and o.created_at > now() - interval '30 days')::int as month,
        count(*) filter (where o.status = 'free')::int as free,
        count(*) filter (where o.status = 'paid')::int as paid,
        count(*) filter (where o.status = 'pending' and o.created_at < now() - ${ABANDON})::int as abandoned,
        count(*) filter (where o.status = 'pending' and o.created_at >= now() - ${ABANDON})::int as waiting,
        coalesce(sum(o.amount_pence) filter (where o.status = 'paid'), 0)::int as revenue,
        coalesce(sum(o.amount_pence) filter (where o.status = 'paid' and o.paid_at > now() - interval '30 days'), 0)::int as revenue30,
        count(distinct o.contact_id) filter (where o.status in ('free', 'paid'))::int as customers,
        (select count(*)::int from crm_events e where e.kind = 'download') as downloads,
        (select count(*)::int from crm_events e where e.kind = 'download' and e.created_at > now() - interval '30 days') as downloads30
      from crm_orders o`)) as unknown as Array<Record<string, number>>;
    const days = (await db().execute(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        (select count(*)::int from crm_orders o where o.status in ('free', 'paid') and o.created_at::date = d) as n,
        (select coalesce(sum(o.amount_pence), 0)::int from crm_orders o where o.status = 'paid' and o.paid_at::date = d) as pence
      from generate_series(current_date - 29, current_date, interval '1 day') d order by d`)) as unknown as Array<{ day: string; n: number; pence: number }>;
    const sellers = (await db().execute(sql`
      select i as slug, count(*)::int as orders,
        count(*) filter (where o.status = 'paid')::int as paid,
        (select count(*)::int from crm_events e where e.kind = 'download' and e.detail = i) as downloads
      from crm_orders o, unnest(o.items) i where o.status in ('free', 'paid') group by i order by orders desc`)) as unknown as Array<{ slug: string; orders: number; paid: number; downloads: number }>;
    const recent = await ordersQuery({ limit: 8 });
    return {
      ready: true,
      kpi: k,
      days,
      sellers: sellers.map((s) => ({ ...s, title: title(s.slug), pricePence: books.find((b) => b.slug === s.slug)?.pricePence ?? 0 })),
      recent: recent.map((o) => ({ ...o, titles: o.items.map(title) })),
    };
  } catch {
    return { ready: false, kpi: {} as Record<string, number>, days: [], sellers: [], recent: [] };
  }
}

async function ordersQuery(f: { status?: string; book?: string; q?: string; limit?: number }) {
  const status = ["free", "paid", "pending", "abandoned"].includes(f.status ?? "") ? f.status! : null;
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 100);
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const num = /^\d{1,9}$/.test(q) ? Number(q) : -1;
  const rows = (await db().execute(sql`
    select o.id, o.number, o.items, o.amount_pence, ${statusExpr} as status, o.created_at, o.paid_at, c.id as contact_id, c.name, c.email, c.club_name,
      (select count(*)::int from crm_events e where e.contact_id = c.id and e.kind = 'download' and e.detail = any(o.items)) as downloads
    from crm_orders o join crm_contacts c on c.id = o.contact_id
    where (${status}::text is null or ${statusExpr} = ${status})
      and (${f.book ?? null}::text is null or ${f.book ?? null} = any(o.items))
      and (${q} = '' or o.number = ${num} or lower(c.email) like ${like} or lower(c.name) like ${like} or lower(c.club_name) like ${like})
    order by o.created_at desc limit ${f.limit ?? 500}`)) as unknown as OrderRow[];
  return rows.map((r) => ({
    id: r.id, number: r.number, items: r.items, amountPence: r.amount_pence, status: r.status, createdAt: new Date(r.created_at), paidAt: r.paid_at ? new Date(r.paid_at) : null,
    contactId: r.contact_id, name: r.name, email: r.email, clubName: r.club_name, downloads: r.downloads,
  }));
}

/** Every order, newest first, with filters for the Orders tab. */
export async function shopOrders(f: { status?: string; book?: string; q?: string }) {
  await requireSuperAdmin();
  const books = await allEbooks();
  const title = (s: string) => books.find((b) => b.slug === s)?.title ?? s;
  const book = books.find((b) => b.slug === f.book)?.slug;
  const rows = await ordersQuery({ ...f, book });
  const [counts] = (await db().execute(sql`
    select count(*)::int as all,
      count(*) filter (where status = 'paid')::int as paid,
      count(*) filter (where status = 'free')::int as free,
      count(*) filter (where status = 'pending' and created_at >= now() - ${ABANDON})::int as pending,
      count(*) filter (where status = 'pending' and created_at < now() - ${ABANDON})::int as abandoned
    from crm_orders`)) as unknown as Array<Record<OrderStatus | "all", number>>;
  return { orders: rows.map((o) => ({ ...o, titles: o.items.map(title) })), counts, books: books.map((b) => ({ slug: b.slug, title: b.title })) };
}

/** Orders as a CSV file. */
export async function ordersCsv(): Promise<string> {
  await requireSuperAdmin();
  const books = await allEbooks();
  const title = (s: string) => books.find((b) => b.slug === s)?.title ?? s;
  const rows = await ordersQuery({ limit: 100000 });
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Order", "Date", "Status", "Amount (£)", "Ebooks", "Name", "Email", "Club", "Downloads", "Paid at"];
  const body = rows.map((o) => [o.number, o.createdAt, ORDER_LABEL[o.status], (o.amountPence / 100).toFixed(2), o.items.map(title).join("; "), o.name, o.email, o.clubName, o.downloads, o.paidAt ?? ""].map(cell).join(","));
  return [head.join(","), ...body].join("\n");
}
