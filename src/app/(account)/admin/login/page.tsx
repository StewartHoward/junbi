import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { isSuperAdmin } from "@/auth/admin";
import { AdminLoginForm } from "./AdminLoginForm";
import { AdminSetupForm } from "./AdminSetupForm";

export const metadata: Metadata = { title: "Junbi admin", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user && isSuperAdmin(user.email)) redirect("/admin");
  return (
    <div className="m-auth">
      <h1>Junbi admin.</h1>
      <p style={{ color: "#6e6e73", marginTop: 8 }}>For the Junbi team only. Clubs sign in <a className="m-link" href="/login">here</a>.</p>
      <AdminLoginForm />
      <details style={{ marginTop: 40 }}>
        <summary className="m-link" style={{ cursor: "pointer" }}>First time here, or forgotten your password?</summary>
        <AdminSetupForm />
      </details>
    </div>
  );
}
