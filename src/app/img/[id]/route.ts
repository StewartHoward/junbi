import { shrinkPhoto, websiteImage } from "@/data/website";

export const dynamic = "force-dynamic";

/** Smaller copies for phones and galleries, picked with ?w=. Only these widths, so nobody can ask for thousands. */
const WIDTHS = new Set([480, 960]);

/** Photos on club websites. Ids never change, so browsers can keep them for a year. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = await websiteImage((await params).id);
  if (!image) return new Response("Not found", { status: 404 });
  const w = Number(new URL(req.url).searchParams.get("w"));
  let body: Buffer = image.data;
  let type = image.mime;
  if (WIDTHS.has(w)) {
    const small = await shrinkPhoto(image.data, w);
    if (small) {
      body = small.data;
      type = "image/webp";
    }
  }
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
