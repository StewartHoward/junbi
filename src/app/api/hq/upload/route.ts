import { NextResponse } from "next/server";
import { uploadChunk } from "@/data/library";
import { UPLOAD_CHUNK } from "@/lib/ebooks";

export const dynamic = "force-dynamic";

/**
 * One piece of an ebook PDF or cover image from HQ, sent as raw bytes. Junbi admins only (checked in
 * uploadChunk). The browser splits big files so each request stays under the hosting limit.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host && new URL(origin).host !== req.headers.get("x-forwarded-host")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const h = (k: string) => req.headers.get(k) ?? "";
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > UPLOAD_CHUNK) return NextResponse.json({ error: "Too big" }, { status: 413 });
  const kind = h("x-kind") === "cover" ? "cover" : "pdf";
  const r = await uploadChunk({ ebookId: h("x-ebook"), kind, index: Number(h("x-index")), total: Number(h("x-total")), size: Number(h("x-size")), name: decodeURIComponent(h("x-name")), data: buf });
  if (!r.ok) return NextResponse.json({ error: r.errors.form ?? "Upload failed" }, { status: 400 });
  if (r.value.done) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/library");
    revalidatePath("/library/[slug]", "page");
    revalidatePath("/admin/hq", "layout");
  }
  return NextResponse.json({ ok: true, done: r.value.done });
}
