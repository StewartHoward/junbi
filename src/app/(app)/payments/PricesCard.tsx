import { formatPence } from "@/data/students";
import { archivePlanAction, setPlanOnSignupAction } from "./actions";
import { PlanForm } from "./PlanForm";
import { SignupFeeForm } from "./SignupFeeForm";

type Plan = { id: string; name: string; amountPence: number; interval: string; showOnSignup?: boolean };

const every = (i: string) => (i === "annual" ? "a year" : i === "termly" ? "a term" : "a month");

/** The club's membership prices: what families choose from on the sign-up link and QR code. */
export function PricesCard({ plans, manage, connected, signupFeePence }: { plans: Plan[]; manage: boolean; connected: boolean; signupFeePence: number }) {
  return (
    <section className="card" style={{ marginTop: 20 }} id="prices">
      <h2 className="section-title">Membership prices</h2>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
        Families pick from these for each child when they sign up with your link or QR code. Old prices you no longer offer can be hidden from
        the sign-up form and still used for existing members.
        {connected ? " They then set up their Direct Debit straight away." : ""}
      </p>
      {plans.length > 0 ? (
        <div className="list" style={{ marginTop: 8 }}>
          {plans.map((pl) => (
            <div key={pl.id}>
              <span>
                <strong>{pl.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}> · {formatPence(pl.amountPence)} {every(pl.interval)}</span>
                {pl.showOnSignup === false && <span className="pill neutral" style={{ marginLeft: 8 }}>Not on sign-up form</span>}
              </span>
              {manage && (
                <span className="actions">
                  <form action={setPlanOnSignupAction}>
                    <input type="hidden" name="planId" value={pl.id} />
                    <input type="hidden" name="show" value={pl.showOnSignup === false ? "1" : "0"} />
                    <button className="btn ghost" title={pl.showOnSignup === false ? "Offer this price to new families again" : "Keep it for existing members but stop offering it to new families"}>
                      {pl.showOnSignup === false ? "Show on sign-up" : "Hide from sign-up"}
                    </button>
                  </form>
                  <form action={archivePlanAction}>
                    <input type="hidden" name="planId" value={pl.id} />
                    <button className="btn ghost" title="Families already on this price carry on">Remove</button>
                  </form>
                </span>
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
