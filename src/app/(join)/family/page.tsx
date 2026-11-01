import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { familyEmail } from "@/data/family";
import { FamilyLinkForm } from "./FamilyLinkForm";

export const metadata: Metadata = { title: "Parent login" };

export default async function FamilyLogin({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await familyEmail()) redirect("/family/home");
  const { expired } = await searchParams;
  return (
    <div className="m-auth">
      <p className="m-eyebrow">Parents and members</p>
      <h1>Sign in.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>See classes, belts, bookings and payments, and keep your details up to date.</p>
      {expired && <p className="error" role="alert" style={{ marginTop: 16 }}>That link has run out. Ask for a new one below.</p>}
      <FamilyLinkForm />
    </div>
  );
}
