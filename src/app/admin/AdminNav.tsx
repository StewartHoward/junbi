"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON = { strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" } as const;

export function AdminNav() {
  const path = usePathname();
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href)) ? "page" : undefined;
  return (
    <div className="nav-links">
      <Link href="/admin" aria-current={on("/admin")}>
        <svg {...ICON} aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
        Clubs
      </Link>
      <Link href="/admin/hq" aria-current={on("/admin/hq")}>
        <svg {...ICON} aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z" /></svg>
        HQ
      </Link>
      <Link href="/admin/crm" aria-current={on("/admin/crm")}>
        <svg {...ICON} aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.8 3.5 6" /></svg>
        Leads
      </Link>
      <Link href="/today">
        <svg {...ICON} aria-hidden="true"><path d="M4 10l8-6 8 6v10H4zM10 20v-6h4v6" /></svg>
        My club
      </Link>
    </div>
  );
}
