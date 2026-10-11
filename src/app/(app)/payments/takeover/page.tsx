import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { takeoverOptions } from "@/data/stripe-own";
import { TakeoverForm } from "./TakeoverForm";

export const metadata: Metadata = { title: "Take over Direct Debits" };
export const dynamic = "force-dynamic";

export default async function TakeoverPage() {
  const actor = await requireActor();
  if (!can(actor, "payments.manage")) redirect("/payments");
  const data = await takeoverOptions(actor).catch((err: unknown) => ({ error: err instanceof Error ? err.message : "Stripe didn't answer." }));

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/payments">Payments</Link> › Take over Direct Debits</p>
      <h1 className="page-title" style={{ marginTop: 8 }}>Take over Direct Debits</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
        These are the payments running in your Stripe account from your old system. Tick the families to move to Junbi. Families are matched by
        email: if one isn&apos;t matched, add or import them in Students first, using the same email.
      </p>

      {"error" in data ? (
        <p className="banner" role="alert" style={{ marginTop: 20 }}>Couldn&apos;t load your Stripe payments: {data.error}</p>
      ) : !data.connected ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Connect your existing Stripe first.</h2>
          <p>Junbi needs access to the Stripe account your Direct Debits are in.</p>
          <Link className="btn primary" href="/payments/stripe-key">Connect your existing Stripe</Link>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Nothing to take over.</h2>
          <p>There are no active payments in your Stripe account that Junbi isn&apos;t already running.</p>
        </div>
      ) : data.plans.length === 0 ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Add your prices first.</h2>
          <p>Each family moves onto one of your Junbi prices. Add them in Settings, then come back.</p>
          <Link className="btn primary" href="/settings#prices">Add prices</Link>
        </div>
      ) : (
        <section className="card" style={{ marginTop: 24 }}>
          <TakeoverForm rows={data.rows} plans={data.plans} />
        </section>
      )}
    </>
  );
}
