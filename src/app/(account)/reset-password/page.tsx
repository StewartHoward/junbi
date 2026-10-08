import Link from "next/link";
import type { Metadata } from "next";
import { resetLinkValid } from "@/data/email-flows";
import { resetPasswordAction } from "../actions";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!(await resetLinkValid(token))) {
    return (
      <div className="m-auth">
        <h1>This link has expired.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>Reset links work for one hour and can only be used once.</p>
        <p className="m-auth-alt">
          <Link href="/forgot-password" className="m-link">Send a new link</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="m-auth">
      <h1>Choose a new password.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>You&apos;ll be signed out everywhere else.</p>
      <ResetForm action={resetPasswordAction.bind(null, token)} />
    </div>
  );
}
