import Link from "next/link";
import type { Metadata } from "next";
import "./marketing.css";
import { NavLinks } from "./NavLinks";

export const metadata: Metadata = {
  title: { absolute: "Junbi · Martial arts club management", template: "%s · Junbi" },
  description:
    "Junbi is simple club management software for UK martial arts clubs. Classes, attendance, Direct Debit and messages to parents, for one flat monthly price. Your fees stay yours.",
  openGraph: {
    title: "Junbi · Your club, ready.",
    description: "Martial arts club management. Classes, attendance, Direct Debit and messages, set up in an evening.",
    type: "website",
    locale: "en_GB",
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt">
      <header className="m-nav">
        <nav aria-label="Main" className="m-nav-inner">
          <Link href="/" className="m-wordmark">
            junbi
          </Link>
          <NavLinks />
        </nav>
      </header>
      <main>{children}</main>
      <footer className="m-footer">
        <div className="m-footer-inner">
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.025em", color: "#1d1d1f" }}>junbi</span>
          <nav aria-label="Footer">
            <Link href="/#features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/founding-clubs">Founding Clubs</Link>
            <Link href="/login">Sign in</Link>
          </nav>
          <span>© 2026 Junbi. Made in the UK for martial arts clubs.</span>
        </div>
      </footer>
    </div>
  );
}
