"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(account)/actions";

const SOON = ["Payments", "Messages"];

export function Sidebar({ clubName, userName, role, links }: { clubName: string; userName: string; role: string; links: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="App">
      <span className="wordmark">junbi</span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      {SOON.map((label) => (
        <span key={label} className="soon" title="Coming soon">
          {label}
        </span>
      ))}
      <div className="who">
        <div style={{ color: "var(--ink)", fontWeight: 500 }}>{userName}</div>
        <div>
          {role[0].toUpperCase() + role.slice(1)} · {clubName}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn ghost" style={{ minHeight: 32, padding: 0, fontSize: 13 }}>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
