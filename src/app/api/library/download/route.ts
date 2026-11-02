import { libraryDownload } from "@/data/crm";
import { fileChunk, fileInfo } from "@/data/library";

export const dynamic = "force-dynamic";

const text = (msg: string) => new Response(msg, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** Sends an ebook PDF for a signed link from a confirmed order, streamed piece by piece from the database. */
export async function GET(req: Request) {
  const book = await libraryDownload(new URL(req.url).searchParams.get("t"));
  if (!book) return text("This download link isn't valid. Open your order email for a fresh one.");
  const info = await fileInfo(book.slug, "pdf");
  if (!info) return text("That ebook isn't available yet. We'll email it to you as soon as it is.");
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = i < info.chunks ? await fileChunk(info.ebookId, "pdf", i++) : null;
      if (chunk) controller.enqueue(new Uint8Array(chunk));
      else controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${book.slug}.pdf"`,
      ...(book.pdf?.size ? { "Content-Length": String(book.pdf.size) } : {}),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
