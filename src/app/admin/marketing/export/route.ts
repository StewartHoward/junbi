import { prospectsCsv } from "@/data/marketing";

export const dynamic = "force-dynamic";

/** The prospect list as a CSV file. Junbi admins only. */
export async function GET() {
  const csv = await prospectsCsv();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="junbi-prospects-${day}.csv"`, "Cache-Control": "private, no-store" },
  });
}
