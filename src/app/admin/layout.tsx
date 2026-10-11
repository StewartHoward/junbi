import Link from "next/link";
import { requireSuperAdmin } from "@/auth/admin";
import { adminLogoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Admin">
        <span className="wordmark">junbi</span>
        <span className="brand-sub">Admin</span>
        <Link href="/admin" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>
          Clubs
        </Link>
        <Link href="/today">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10l8-6 8 6v10H4zM10 20v-6h4v6" /></svg>
          My club
        </Link>
        <div className="who">
          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{user.name}</div>
          <div>Junbi admin</div>
          <form action={adminLogoutAction}>
            <button type="submit" className="btn ghost" style={{ minHeight: 32, padding: 0, fontSize: 13 }}>Sign out</button>
          </form>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
