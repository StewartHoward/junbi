import { websiteImage } from "@/data/website";

export const dynamic = "force-dynamic";

/** Photos on club websites. Ids never change, so browsers can keep them for a year. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = await websiteImage((await params).id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
