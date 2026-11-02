import { AdminNav } from "./AdminNav";
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
        <AdminNav />
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
