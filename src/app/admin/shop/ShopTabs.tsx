import Link from "next/link";

/** Overview, Orders and Ebooks tabs at the top of every Shop page. */
export function ShopTabs({ on }: { on: "overview" | "orders" | "ebooks" }) {
  const tabs = [["overview", "/admin/shop", "Overview"], ["orders", "/admin/shop/orders", "Orders"], ["ebooks", "/admin/shop/ebooks", "Ebooks"]] as const;
  return (
    <nav className="seg" aria-label="Shop" style={{ marginTop: 20 }}>
      {tabs.map(([k, href, label]) => <Link key={k} href={href} aria-current={on === k ? "true" : undefined}>{label}</Link>)}
    </nav>
  );
}

export const ORDER_PILL = { paid: "ok", free: "blue", pending: "warn", abandoned: "neutral" } as const;
export const money = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
