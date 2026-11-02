import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { redirect } from "next/navigation";
import { currentActor } from "@/auth/session";
import { SELF_SERVE_PLANS } from "@/lib/plans";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = pageMeta({ ownImage: true, title: "Start your free trial", description: "Try Junbi free for 7 days. Set up your martial arts club in an evening: students, classes, Direct Debit and more.", path: "/signup" });

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; code?: string }> }) {
  if (await currentActor()) redirect("/today");
  const { plan, code } = await searchParams;
  return (
    <div className="m-auth">
      <h1>Set up your club.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        Free for 7 days. Takes about five minutes.
      </p>
      <SignupForm plan={SELF_SERVE_PLANS.some((p) => p.id === plan) ? plan! : "starter"} code={typeof code === "string" ? code.slice(0, 40) : ""} />
    </div>
  );
}
