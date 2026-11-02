import { readFile } from "node:fs/promises";
import path from "node:path";
import { libraryDownload } from "@/data/crm";

export const dynamic = "force-dynamic";

/** Sends an ebook PDF for a signed link from an order. Files live in content/ebooks and are never public. */
export async function GET(req: Request) {
  const book = await libraryDownload(new URL(req.url).searchParams.get("t"));
  if (!book) return new Response("This download link isn't valid. Open your order email for a fresh one.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  try {
    const file = await readFile(path.join(process.cwd(), "content", "ebooks", `${book.slug}.pdf`));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${book.slug}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("That ebook isn't available yet. We'll email it to you as soon as it is.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
