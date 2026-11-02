import { ebookBySlug, fileChunk, fileInfo } from "@/data/library";

export const dynamic = "force-dynamic";

/** Uploaded cover images. The URL changes when a new cover is uploaded, so browsers can keep them. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await ebookBySlug(slug, { drafts: true });
  const info = book ? await fileInfo(slug, "cover") : null;
  const data = info ? await fileChunk(info.ebookId, "cover", 0) : null;
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
