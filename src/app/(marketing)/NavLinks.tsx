"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#gradings", label: "Gradings" },
  { href: "/#payments", label: "Direct Debit" },
  { href: "/#associations", label: "Associations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dev/login", label: "Try the demo" },
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
      <Link href="/founding-clubs" className="m-pill-sm" aria-current={current("/founding-clubs")}>
        <span className="m-long">Become a Founding Club</span>
        <span className="m-short">Join</span>
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
