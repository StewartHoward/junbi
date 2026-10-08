import type { Metadata } from "next";
import { lookupInvite } from "@/data/email-flows";
import { acceptInviteAction } from "../actions";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Join your club" };

const ROLE: Record<string, string> = { admin: "an admin", instructor: "an instructor", assistant: "an assistant" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const inv = await lookupInvite(token);
  if (!inv) {
    return (
      <div className="m-auth">
        <h1>This invitation has expired.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>Invitations last 7 days. Ask your club to send a new one.</p>
      </div>
    );
  }
  return (
    <div className="m-auth">
      <p className="m-eyebrow">{inv.clubName}</p>
      <h1>Join {inv.clubName}.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>
        {inv.inviterName ? `${inv.inviterName} has invited you` : "You've been invited"} to join as {ROLE[inv.role] ?? inv.role}.
        {inv.userExists ? " Sign in with your Junbi password to accept." : " Set up your login to accept."}
      </p>
      <InviteForm action={acceptInviteAction.bind(null, token, inv.userExists)} email={inv.email} existing={inv.userExists} />
    </div>
  );
}
