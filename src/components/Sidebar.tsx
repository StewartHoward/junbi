"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIVE = [{ href: "/students", label: "Students" }];
const SOON = ["Today", "Classes", "Gradings", "Payments", "Messages", "Shop", "Reports", "Settings"];

export function Sidebar({ clubName, userName, role }: { clubName: string; userName: string; role: string }) {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="App">
      <span className="wordmark">junbi</span>
      {LIVE.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      {SOON.map((label) => (
        <span key={label} className="soon" title="Coming in a later build">
          {label}
        </span>
      ))}
      <div className="who">
        <div style={{ color: "var(--ink)", fontWeight: 500 }}>{userName}</div>
        <div>
          {role[0].toUpperCase() + role.slice(1)} · {clubName}
        </div>
        <a href="/dev/login">Switch user</a>
      </div>
    </nav>
  );
}
