import Link from "next/link";
import type { Metadata } from "next";
import "./marketing.css";
import { NavLinks } from "./NavLinks";
import { SupportWidget } from "@/components/SupportWidget";

export const metadata: Metadata = {
  title: { default: "Junbi", template: "%s · Junbi" },
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
            <Link href="/features">Features</Link>
            <Link href="/club-software/taekwondo">Taekwondo</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/elite">Elite</Link>
            <Link href="/competitions">Competitions</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/library">Library</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/admin/login">Admin login</Link>
          </nav>
          <span>© 2026 Junbi. Made in the UK for taekwondo clubs.</span>
        </div>
      </footer>
      <SupportWidget />
    </div>
  );
}
