import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActorForSetup } from "@/auth/session";
import { can } from "@/auth/permissions";
import { clubBilling } from "@/data/billing";
import { formatPounds } from "@/lib/plans";
import { AddCardButton, BillingCodeForm, ManageBillingButton } from "./BillingButtons";

export const metadata: Metadata = { title: "Billing" };

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const STATUS: Record<string, string> = {
  trialing: "Card added. Free trial running.",
  active: "Paid up. Thanks!",
  past_due: "Your last payment didn't go through. Please update your card.",
  unpaid: "Payments have failed. Please update your card.",
  canceled: "Your Junbi plan is cancelled.",
  incomplete: "Card not confirmed yet.",
};

export default async function BillingPage() {
  const actor = await requireActorForSetup();
  if (!can(actor, "club.manage")) redirect("/today");
  const b = await clubBilling(actor);
  const after = b.fee.status === "trial" ? (b.founding || b.discountPercent ? `${formatPounds(Math.round(b.listPence * (100 - Math.max(b.founding ? 50 : 0, b.discountPercent ?? 0)) / 100))} a month` : `${formatPounds(b.listPence)} a month`) : `${formatPounds(b.fee.pence)} a month`;
  const next = actor.onboarded ? "/today" : "/setup";

  return (
    <div className="m-auth" style={{ maxWidth: 560 }}>
      {b.needsCard ? (
        <>
          <h1>{b.fee.status === "trial" ? "Start your free trial." : "Add a card to carry on."}</h1>
          <p className="m-sub" style={{ fontSize: 19 }}>
            {b.fee.status === "trial" && b.trialEndsOn
              ? <>Nothing to pay today. Your first payment of <strong>{after}</strong> is taken on {longDate(b.trialEndsOn)}, when your trial ends. Cancel any time before then and you won&apos;t be charged.</>
              : <>Your free trial has ended. Junbi {b.planName} is <strong>{after}</strong>, taken monthly. Cancel any time.</>}
          </p>
          <ul style={{ margin: "16px 0 24px", paddingLeft: 20, color: "#1d1d1f", lineHeight: 1.7 }}>
            <li>{b.planName} plan, every feature included</li>
            {b.founding && <li>Founding Club: 50% off for your first six months</li>}
            {b.promoCode && <li>Code {b.promoCode}: {b.discountPercent}% off{b.discountMonths ? ` for ${b.discountMonths} months` : ""}</li>}
            <li>Card handled securely by Stripe</li>
          </ul>
          <AddCardButton label={b.fee.status === "trial" ? "Add card and start trial" : "Add card"} />
          <details style={{ marginTop: 32 }}>
            <summary className="m-link" style={{ cursor: "pointer" }}>Have a discount code?</summary>
            <BillingCodeForm />
          </details>
        </>
      ) : (
        <>
          <h1>Junbi billing.</h1>
          <p className="m-sub" style={{ fontSize: 19 }}>
            {b.freeForGood ? "Your account is free, so there's nothing to pay." : STATUS[b.status ?? ""] ?? "Billing is set up."}
          </p>
          {!b.freeForGood && (
            <p style={{ marginTop: 12 }}>
              {b.planName} plan · {b.fee.status === "trial" && b.trialEndsOn ? `first payment ${longDate(b.trialEndsOn)}, ${after}` : after}
              {b.periodEnd && b.fee.status !== "trial" ? ` · next bill ${b.periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}
            </p>
          )}
          {b.hasCustomer && <div style={{ marginTop: 20 }}><ManageBillingButton /></div>}
          {b.invoices.length > 0 && (
            <table style={{ width: "100%", marginTop: 28, borderCollapse: "collapse", fontSize: 15 }}>
              <thead><tr><th style={{ textAlign: "left", fontWeight: 500, color: "#6e6e73", padding: "6px 0" }}>Date</th><th style={{ textAlign: "left", fontWeight: 500, color: "#6e6e73" }}>Amount</th><th style={{ textAlign: "left", fontWeight: 500, color: "#6e6e73" }}>Status</th><th /></tr></thead>
              <tbody>
                {b.invoices.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid #e5e5ea" }}>
                    <td style={{ padding: "10px 0" }}>{(i.paidAt ?? i.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{formatPounds(i.amountPence)}</td>
                    <td>{i.status === "paid" ? "Paid" : i.status === "failed" ? "Failed" : i.status}</td>
                    <td>{i.hostedUrl && <a className="m-link" href={i.hostedUrl} target="_blank" rel="noreferrer">Invoice</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="m-auth-alt" style={{ marginTop: 28 }}><Link href={next} className="m-link">Back to Junbi</Link></p>
        </>
      )}
    </div>
  );
}
