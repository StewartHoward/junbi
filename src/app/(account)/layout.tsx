import Link from "next/link";
import "../(marketing)/marketing.css";

export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="m-nav" style={{ position: "static" }}>
        <nav className="m-nav-inner" aria-label="Main">
          <Link href="/" className="m-wordmark">
            junbi
          </Link>
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
