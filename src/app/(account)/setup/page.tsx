import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActorForSetup } from "@/auth/session";
import { can } from "@/auth/permissions";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Set up your club" };

export default async function SetupPage() {
  const actor = await requireActorForSetup();
  if (actor.onboarded) redirect("/today");
  if (!can(actor, "club.manage")) {
    return (
      <div className="m-auth">
        <h1>Almost ready.</h1>
        <p className="m-sub">Your club owner needs to finish setting up {actor.clubName} before you can sign in.</p>
      </div>
    );
  }
  return (
    <div className="m-auth" style={{ maxWidth: 760 }}>
      <p className="m-eyebrow">Welcome, {actor.userName.split(" ")[0]}</p>
      <h1>Let&apos;s set up {actor.clubName}.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Three quick questions and your dashboard is ready.</p>
      <SetupForm />
    </div>
  );
}
