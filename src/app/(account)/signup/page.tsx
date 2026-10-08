import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentActor } from "@/auth/session";
import { SELF_SERVE_PLANS } from "@/lib/plans";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; founding?: string }> }) {
  if (await currentActor()) redirect("/today");
  const { plan, founding } = await searchParams;
  const isFounding = founding === "1";
  return (
    <div className="m-auth">
      {isFounding && <p className="m-eyebrow">Founding Clubs</p>}
      <h1>{isFounding ? "Be one of the first 100." : "Set up your club."}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {isFounding
          ? "50% off for six months once your trial ends, free migration, and your price locked for two years."
          : "Free for 30 days. Takes about five minutes."}
      </p>
      <SignupForm plan={SELF_SERVE_PLANS.some((p) => p.id === plan) ? plan! : "essentials"} founding={isFounding} />
    </div>
  );
}
