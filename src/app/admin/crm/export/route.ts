import { crmCsv } from "@/data/crm";

export const dynamic = "force-dynamic";

/** Every lead as a CSV file, for a spreadsheet or another tool. Junbi admins only. */
export async function GET() {
  const csv = await crmCsv();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="junbi-leads-${day}.csv"`, "Cache-Control": "private, no-store" },
  });
}
