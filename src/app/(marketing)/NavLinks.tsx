"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#arts", label: "Martial arts" },
  { href: "/#payments", label: "Direct Debit" },
  { href: "/#switching", label: "Switching" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Sign in" },
];

export function NavLinks() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <div id="m-nav-menu" className={`m-nav-links${open ? " open" : ""}`}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
      </div>
      <Link href="/signup" className="m-pill-sm">
        <span className="m-long">Start free trial</span>
        <span className="m-short">Try free</span>
      </Link>
      <button
        type="button"
        className="m-menu-btn"
        aria-expanded={open}
        aria-controls="m-nav-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          {open ? (
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          ) : (
            <path d="M2 6h14M2 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
      </button>
    </>
  );
}
