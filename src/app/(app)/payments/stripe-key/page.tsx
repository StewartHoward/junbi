import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { KeyForm } from "./KeyForm";

export const metadata: Metadata = { title: "Connect your Stripe account" };

export default async function StripeKeyPage() {
  const actor = await requireActor();
  if (!can(actor, "club.manage")) redirect("/payments");
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/payments">Payments</Link> › Your existing Stripe</p>
      <h1 className="page-title" style={{ marginTop: 8 }}>Connect your existing Stripe account</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
        Already collecting through Stripe, for example with another system? Connect that same account and Junbi can take over the Direct
        Debits already running there. Families don&apos;t need to sign anything again.
      </p>

      <section className="card" style={{ marginTop: 24, maxWidth: 720 }}>
        <h2 className="section-title">1. Make a key in Stripe</h2>
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Sign in to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">dashboard.stripe.com/apikeys</a> with your club&apos;s Stripe login.</li>
          <li>Click <strong>Create a secret key</strong> (or <strong>Create restricted key</strong>) and name it <strong>Junbi</strong>.</li>
          <li>
            Full access works. If you&apos;d rather limit it, give it <strong>write</strong> access to Customers, Subscriptions, Products, Checkout
            Sessions and Webhook endpoints, and <strong>read</strong> access to Payment methods, Invoices, Mandates and Account.
          </li>
          <li>Copy the key. It starts with <code>sk_live_</code> or <code>rk_live_</code>.</li>
        </ol>
      </section>

      <section className="card" style={{ marginTop: 20, maxWidth: 720 }}>
        <h2 className="section-title">2. Paste it here</h2>
        <div style={{ marginTop: 12 }}>
          <KeyForm />
        </div>
      </section>
    </>
  );
}
