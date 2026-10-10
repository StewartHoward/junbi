import type { Metadata } from "next";
import { joinForm } from "@/data/join";
import { JoinFormView } from "./JoinForm";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const f = await joinForm((await params).token);
  return { title: f ? `Sign up to ${f.clubName}` : "Sign-up link", robots: { index: false, follow: false } };
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const f = await joinForm(token);
  if (!f) {
    return (
      <div className="m-auth">
        <h1>This link has changed.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>Ask the club for their new sign-up link.</p>
      </div>
    );
  }
  return (
    <div className="m-auth" style={{ maxWidth: 640 }}>
      <p className="m-eyebrow">{f.clubName}</p>
      <h1>Sign up.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Takes about two minutes. Everything you tell us goes straight to the club.</p>
      <JoinFormView token={token} sites={f.sites} />
    </div>
  );
}
