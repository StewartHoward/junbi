import { ordersCsv } from "@/data/shop-admin";

export const dynamic = "force-dynamic";

/** Every Library order as a CSV file. Junbi admins only. */
export async function GET() {
  const csv = await ordersCsv();
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="junbi-orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" },
  });
}
