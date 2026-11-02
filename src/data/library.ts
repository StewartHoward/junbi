import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { MAX_COVER, MAX_PDF, UPLOAD_CHUNK, type Ebook, type EbookStatus } from "@/lib/ebooks";
import type { Result } from "./accounts";

/*
 * Ebooks for the Junbi Library, edited in HQ. These belong to Junbi, not to a club.
 * Files are stored in the database in chunks (library_files), so uploads and downloads work through the app's
 * normal requests without extra storage accounts.
 */

type Row = {
  id: string; slug: string; title: string; subtitle: string; pitch: string; description: string; pages: number; price_pence: number; worth_pence: number | null;
  cover_bg: string; cover_fg: string; cover_accent: string; for_who: string[]; contents: string[]; tip_heading: string; tip_body: string;
  status: EbookStatus; sort: number; pdf_name: string | null; pdf_size: number | null; pdf_uploaded_at: Date | null; cover_uploaded_at: Date | null;
};

const shape = (r: Row): Ebook => ({
  id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle, pitch: r.pitch, description: r.description, pages: r.pages,
  pricePence: r.price_pence, worthPence: r.worth_pence, cover: { bg: r.cover_bg, fg: r.cover_fg, accent: r.cover_accent },
  coverUrl: r.cover_uploaded_at ? `/api/library/cover/${r.slug}?v=${new Date(r.cover_uploaded_at).getTime()}` : null,
  forWho: r.for_who, contents: r.contents, tip: { heading: r.tip_heading, body: r.tip_body }, status: r.status, sort: r.sort,
  pdf: r.pdf_name && r.pdf_uploaded_at ? { name: r.pdf_name, size: r.pdf_size ?? 0, uploadedAt: new Date(r.pdf_uploaded_at) } : null,
  ready: r.status === "live" && Boolean(r.pdf_uploaded_at),
});

/** Every ebook, in shop order. Read once per request. Empty if the table isn't there yet. */
export const allEbooks = cache(async (): Promise<Ebook[]> => {
  try {
    const rows = (await db().execute(sql`select * from library_ebooks order by sort, created_at`)) as unknown as Row[];
    return rows.map(shape);
  } catch {
    return [];
  }
});

/** Ebooks people can see and order: pre-orders and live ones, not drafts. */
export async function shopEbooks() {
  return (await allEbooks()).filter((b) => b.status !== "draft");
}

export async function ebookBySlug(slug: string, opts: { drafts?: boolean } = {}) {
  const b = (await allEbooks()).find((x) => x.slug === slug) ?? null;
  return b && (opts.drafts || b.status !== "draft") ? b : null;
}

/* ---------- Files ---------- */

/** The chunks of a stored file, in order, without loading them all at once. */
export async function fileInfo(slug: string, kind: "pdf" | "cover") {
  const [r] = (await db().execute(sql`
    select e.id, e.pdf_name, count(f.chunk)::int as chunks from library_ebooks e left join library_files f on f.ebook_id = e.id and f.kind = ${kind}
    where e.slug = ${slug} group by e.id`)) as unknown as Array<{ id: string; pdf_name: string | null; chunks: number }>;
  return r && r.chunks > 0 ? { ebookId: r.id, name: r.pdf_name, chunks: r.chunks } : null;
}

export async function fileChunk(ebookId: string, kind: "pdf" | "cover", chunk: number): Promise<Buffer | null> {
  const [r] = (await db().execute(sql`select data from library_files where ebook_id = ${ebookId}::uuid and kind = ${kind} and chunk = ${chunk}`)) as unknown as Array<{ data: Buffer }>;
  return r ? Buffer.from(r.data) : null;
}

/* ---------- HQ (Junbi admins only) ---------- */

const lines = (max: number) => z.array(z.string().trim().min(1).max(200)).max(max);
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1d1d1f.");
const money = z.union([z.literal(""), z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Enter a price like 9.99, or 0 for free.")]);

const ebookSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and dashes, like full-classes.").min(2).max(60),
  title: z.string().trim().min(1, "Give it a title.").max(120),
  subtitle: z.string().trim().max(200),
  pitch: z.string().trim().max(200),
  description: z.string().trim().max(5000),
  pages: z.coerce.number().int().min(0).max(2000),
  price: money,
  worth: money,
  coverBg: colour,
  coverFg: colour,
  coverAccent: colour,
  forWho: lines(10),
  contents: lines(30),
  tipHeading: z.string().trim().max(120),
  tipBody: z.string().trim().max(1000),
  status: z.enum(["draft", "preorder", "live"]),
  sort: z.coerce.number().int().min(0).max(999),
});
export type EbookInput = z.input<typeof ebookSchema>;

const pence = (s: string) => (s === "" ? null : Math.round(Number(s) * 100));

/** Creates or updates an ebook. Returns its id. */
export async function saveEbook(id: string | null, raw: EbookInput): Promise<Result<{ id: string; slug: string }>> {
  await requireSuperAdmin();
  const p = ebookSchema.safeParse(raw);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  const price = pence(d.price) ?? 0;
  const worth = pence(d.worth);
  if (worth !== null && worth <= price) return { ok: false, errors: { worth: "The 'worth' price should be more than the real price, or leave it blank." } };
  if (id && !z.string().uuid().safeParse(id).success) return { ok: false, errors: { form: "Unknown ebook." } };
  const [taken] = (await db().execute(sql`select id from library_ebooks where slug = ${d.slug} and (${id}::uuid is null or id <> ${id}::uuid)`)) as unknown as Array<{ id: string }>;
  if (taken) return { ok: false, errors: { slug: "Another ebook already uses that web address." } };
  if (d.status === "live" && id) {
    const [f] = (await db().execute(sql`select pdf_uploaded_at from library_ebooks where id = ${id}::uuid`)) as unknown as Array<{ pdf_uploaded_at: Date | null }>;
    if (!f?.pdf_uploaded_at) return { ok: false, errors: { status: "Upload the PDF before making it live. Use Pre-orders until then." } };
  } else if (d.status === "live") {
    return { ok: false, errors: { status: "Save it first, then upload the PDF, then make it live." } };
  }
  const arr = (a: string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(a)}::jsonb))::text[]`;
  const vals = sql`${d.slug}, ${d.title}, ${d.subtitle}, ${d.pitch}, ${d.description}, ${d.pages}, ${price}, ${worth}, ${d.coverBg}, ${d.coverFg}, ${d.coverAccent}, ${arr(d.forWho)}, ${arr(d.contents)}, ${d.tipHeading}, ${d.tipBody}, ${d.status}, ${d.sort}`;
  const [r] = id
    ? ((await db().execute(sql`
        update library_ebooks set (slug, title, subtitle, pitch, description, pages, price_pence, worth_pence, cover_bg, cover_fg, cover_accent, for_who, contents, tip_heading, tip_body, status, sort, updated_at)
          = (${vals}, now()) where id = ${id}::uuid returning id, slug`)) as unknown as Array<{ id: string; slug: string }>)
    : ((await db().execute(sql`
        insert into library_ebooks (slug, title, subtitle, pitch, description, pages, price_pence, worth_pence, cover_bg, cover_fg, cover_accent, for_who, contents, tip_heading, tip_body, status, sort)
        values (${vals}) returning id, slug`)) as unknown as Array<{ id: string; slug: string }>);
  if (!r) return { ok: false, errors: { form: "That ebook no longer exists." } };
  return { ok: true, value: r };
}

/** Deletes an ebook nobody has ordered. Ordered ones can only be hidden (set to Draft). */
export async function deleteEbook(id: string): Promise<Result> {
  await requireSuperAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, errors: { form: "Unknown ebook." } };
  const [o] = (await db().execute(sql`select count(*)::int as n from crm_orders o, library_ebooks e where e.id = ${id}::uuid and e.slug = any(o.items)`)) as unknown as Array<{ n: number }>;
  if (o?.n) return { ok: false, errors: { form: `${o.n} ${o.n === 1 ? "order includes" : "orders include"} this ebook, so it can't be deleted. Set it to Draft to hide it.` } };
  await db().execute(sql`delete from library_ebooks where id = ${id}::uuid`);
  return { ok: true, value: undefined };
}

/**
 * Receives one chunk of an upload. Chunks land in a holding area and only replace the current file when the
 * last one arrives, so a failed upload never leaves a broken file in the shop.
 */
export async function uploadChunk(input: { ebookId: string; kind: "pdf" | "cover"; index: number; total: number; size: number; name: string; data: Buffer }): Promise<Result<{ done: boolean }>> {
  await requireSuperAdmin();
  const { ebookId, kind, index, total, size, name, data } = input;
  const max = kind === "pdf" ? MAX_PDF : MAX_COVER;
  if (!z.string().uuid().safeParse(ebookId).success || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total || total > Math.ceil(max / UPLOAD_CHUNK)) {
    return { ok: false, errors: { form: "That upload didn't look right. Try again." } };
  }
  if (size > max) return { ok: false, errors: { form: `That file is too big. The limit is ${max / 1024 / 1024}MB.` } };
  if (data.length === 0 || data.length > UPLOAD_CHUNK) return { ok: false, errors: { form: "That upload didn't look right. Try again." } };
  if (index === 0) {
    const ok = kind === "pdf" ? data.subarray(0, 5).toString("latin1") === "%PDF-" : /^(ffd8ff|89504e47|52494646)/.test(data.subarray(0, 4).toString("hex"));
    if (!ok) return { ok: false, errors: { form: kind === "pdf" ? "That file isn't a PDF." : "That file isn't a JPEG, PNG or WebP image." } };
    await db().execute(sql`delete from library_files where ebook_id = ${ebookId}::uuid and kind = 'pdf_upload'`);
  }
  const holding = kind === "pdf" ? "pdf_upload" : "cover";
  if (kind === "cover") {
    // Covers are small: one piece, re-saved as WebP at a sensible size.
    if (total !== 1) return { ok: false, errors: { form: "Cover images must be under 3MB." } };
    let out = data;
    try {
      const sharp = (await import("sharp")).default;
      out = await sharp(data).rotate().resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      return { ok: false, errors: { form: "That image couldn't be read. Try a JPEG or PNG." } };
    }
    await db().execute(sql`delete from library_files where ebook_id = ${ebookId}::uuid and kind = 'cover'`);
    await db().execute(sql`insert into library_files (ebook_id, kind, chunk, data) values (${ebookId}::uuid, 'cover', 0, ${out})`);
    await db().execute(sql`update library_ebooks set cover_uploaded_at = now(), updated_at = now() where id = ${ebookId}::uuid`);
    return { ok: true, value: { done: true } };
  }
  await db().execute(sql`
    insert into library_files (ebook_id, kind, chunk, data) values (${ebookId}::uuid, ${holding}, ${index}, ${data})
    on conflict (ebook_id, kind, chunk) do update set data = excluded.data`);
  if (index < total - 1) return { ok: true, value: { done: false } };
  const [c] = (await db().execute(sql`select count(*)::int as n, coalesce(sum(length(data)), 0)::int as bytes from library_files where ebook_id = ${ebookId}::uuid and kind = 'pdf_upload'`)) as unknown as Array<{ n: number; bytes: number }>;
  if (c.n !== total || c.bytes !== size) {
    await db().execute(sql`delete from library_files where ebook_id = ${ebookId}::uuid and kind = 'pdf_upload'`);
    return { ok: false, errors: { form: "Part of the upload went missing. Try again." } };
  }
  await db().execute(sql`delete from library_files where ebook_id = ${ebookId}::uuid and kind = 'pdf'`);
  await db().execute(sql`update library_files set kind = 'pdf' where ebook_id = ${ebookId}::uuid and kind = 'pdf_upload'`);
  const safeName = name.replace(/[^\w .()-]/g, "").slice(0, 120) || "ebook.pdf";
  await db().execute(sql`update library_ebooks set pdf_name = ${safeName}, pdf_size = ${size}, pdf_uploaded_at = now(), updated_at = now() where id = ${ebookId}::uuid`);
  return { ok: true, value: { done: true } };
}

export async function removeCover(ebookId: string) {
  await requireSuperAdmin();
  if (!z.string().uuid().safeParse(ebookId).success) return;
  await db().execute(sql`delete from library_files where ebook_id = ${ebookId}::uuid and kind = 'cover'`);
  await db().execute(sql`update library_ebooks set cover_uploaded_at = null, updated_at = now() where id = ${ebookId}::uuid`);
}

/** Orders, downloads and money per ebook, for HQ. */
export async function ebookStats() {
  await requireSuperAdmin();
  try {
    const rows = (await db().execute(sql`
      select i as slug, count(distinct o.contact_id)::int as people,
        count(distinct o.contact_id) filter (where o.status in ('free', 'paid') and not exists (select 1 from crm_events e where e.contact_id = o.contact_id and e.kind = 'delivered' and e.detail = i))::int as waiting,
        coalesce(sum(o.amount_pence) filter (where o.status = 'paid'), 0)::int as revenue,
        (select count(*)::int from crm_events e where e.kind = 'download' and e.detail = i) as downloads
      from crm_orders o, unnest(o.items) i group by i`)) as unknown as Array<{ slug: string; people: number; waiting: number; revenue: number; downloads: number }>;
    return rows;
  } catch {
    return [];
  }
}
