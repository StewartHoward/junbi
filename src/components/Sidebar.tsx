"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(account)/actions";

const ICON: Record<string, React.ReactNode> = {
  "/today": <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  "/students": <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  "/leads": <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5M11 8v6M8 11h6" /></>,
  "/classes": <path d="M5 4h14v16H5zM5 9h14M9 4v5M15 4v5" />,
  "/messages": <path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" />,
  "/payments": <path d="M3 7h18v12H3zM3 11h18M7 15h4" />,
  "/settings": <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
};

export function Sidebar({ clubName, sites, userName, role, links }: { clubName: string; sites: string[]; userName: string; role: string; links: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="App">
      <span className="wordmark">{clubName}</span>
      <span className="brand-sub">{sites.length ? sites.join(" · ") : "Junbi"}</span>
      <div className="nav-links">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[l.href]}</svg>
          {l.label}
        </Link>
      ))}
      </div>
      <div className="who">
        <div style={{ color: "var(--ink)", fontWeight: 500 }}>{userName}</div>
        <div>{role[0].toUpperCase() + role.slice(1)} · on Junbi</div>
        <form action={logoutAction}>
          <button type="submit" className="btn ghost" style={{ minHeight: 32, padding: 0, fontSize: 13 }}>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
