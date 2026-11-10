import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { redirect } from "next/navigation";
import { currentActor } from "@/auth/session";
import { LoginForm } from "./LoginForm";
import { featureOn } from "@/data/features";

export const metadata: Metadata = pageMeta({ title: "Sign in", description: "Sign in to Junbi to run your club: students, classes, payments and more.", path: "/login" });

export default async function LoginPage() {
  if (await currentActor()) redirect("/today");
  return (
    <div className="m-auth">
      <h1>Sign in to Junbi.</h1>
      <LoginForm />
      {(await featureOn("family")) && <p style={{ marginTop: 40, fontSize: 14 }}>Parent or member? <a href="/family" className="m-link">Sign in here</a></p>}
      <p style={{ marginTop: 12, fontSize: 14 }}><a href="/admin/login" className="m-link">Admin login</a></p>
    </div>
  );
}
