import { formatPence } from "@/data/students";
import { archivePlanAction } from "./actions";
import { PlanForm } from "./PlanForm";
import { SignupFeeForm } from "./SignupFeeForm";

type Plan = { id: string; name: string; amountPence: number; interval: string };

const every = (i: string) => (i === "annual" ? "a year" : i === "termly" ? "a term" : "a month");

/** The club's membership prices: what families choose from on the sign-up link and QR code. */
export function PricesCard({ plans, manage, connected, signupFeePence }: { plans: Plan[]; manage: boolean; connected: boolean; signupFeePence: number }) {
  return (
    <section className="card" style={{ marginTop: 20 }} id="prices">
      <h2 className="section-title">Membership prices</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        Families pick one of these for each child when they sign up with your link or QR code.
        {connected ? " They then set up their Direct Debit straight away." : ""}
      </p>
      {plans.length > 0 ? (
        <div className="list" style={{ marginTop: 8 }}>
          {plans.map((pl) => (
            <div key={pl.id}>
              <span>
                <strong>{pl.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}> · {formatPence(pl.amountPence)} {every(pl.interval)}</span>
              </span>
              {manage && (
                <form action={archivePlanAction}>
                  <input type="hidden" name="planId" value={pl.id} />
                  <button className="btn ghost" title="Families already on this price carry on">Remove</button>
                </form>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>No prices yet. Add your first one below, e.g. Kids monthly £35.</p>
      )}
      {manage && <div style={{ marginTop: 16 }}><PlanForm /></div>}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Sign-up fee</h3>
        <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
          {signupFeePence
            ? `${formatPence(signupFeePence)} per new member, taken with their first payment. So the first month is the fee plus the membership.`
            : "Charge new members a one-off fee with their first payment, e.g. for a licence or welcome pack. Leave empty for none."}
        </p>
        {manage && <div style={{ marginTop: 12 }}><SignupFeeForm pence={signupFeePence} /></div>}
      </div>
      {!connected && (
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          To have families set up Direct Debit when they sign up, connect Stripe or GoCardless on the <a href="/payments">Payments</a> page.
        </p>
      )}
    </section>
  );
}
