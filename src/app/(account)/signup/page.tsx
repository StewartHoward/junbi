import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentActor } from "@/auth/session";
import { SELF_SERVE_PLANS } from "@/lib/plans";
import { foundingPlacesLeft } from "@/data/accounts";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; founding?: string; code?: string }> }) {
  if (await currentActor()) redirect("/today");
  const { plan, founding, code } = await searchParams;
  const isFounding = founding === "1" && (await foundingPlacesLeft()) > 0;
  return (
    <div className="m-auth">
      {isFounding && <p className="m-eyebrow">Founding Clubs</p>}
      <h1>{isFounding ? "Be one of the first 10." : "Set up your club."}</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {isFounding
          ? "A 7-day free trial, then 50% off for six months, free migration, and your price locked for two years."
          : "Free for 7 days. Takes about five minutes."}
      </p>
      <SignupForm plan={SELF_SERVE_PLANS.some((p) => p.id === plan) ? plan! : "starter"} founding={isFounding} code={typeof code === "string" ? code.slice(0, 40) : ""} />
    </div>
  );
}
