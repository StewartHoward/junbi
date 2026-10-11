import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentActor } from "@/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentActor()) redirect("/today");
  return (
    <div className="m-auth">
      <h1>Sign in to Junbi.</h1>
      <LoginForm />
      <p style={{ marginTop: 40, fontSize: 14 }}><a href="/admin/login" className="m-link">Admin login</a></p>
    </div>
  );
}
