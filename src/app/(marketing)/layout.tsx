import Link from "next/link";
import type { Metadata } from "next";
import "./marketing.css";
import { NavLinks } from "./NavLinks";

export const metadata: Metadata = {
  title: { default: "Junbi · Taekwondo club management", template: "%s · Junbi" },
  description:
    "Junbi is club management software built only for UK taekwondo schools. Student profiles, Direct Debit, gradings and a family app, for one flat monthly price. Your fees stay yours.",
  openGraph: {
    title: "Junbi · Your club, ready.",
    description: "Taekwondo club management. Members, payments and gradings, all set before the class bows in.",
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
            <Link href="/dev/login">Try the demo</Link>
          </nav>
          <span>© 2026 Junbi. Made for taekwondo in the UK.</span>
        </div>
      </footer>
    </div>
  );
}
