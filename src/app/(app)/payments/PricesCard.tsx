import { formatPence } from "@/data/students";
import { archivePlanAction } from "./actions";
import { PlanForm } from "./PlanForm";

type Plan = { id: string; name: string; amountPence: number; interval: string };

const every = (i: string) => (i === "annual" ? "a year" : i === "termly" ? "a term" : "a month");

/** The club's membership prices: what families choose from on the sign-up link and QR code. */
export function PricesCard({ plans, manage, connected }: { plans: Plan[]; manage: boolean; connected: boolean }) {
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
      {!connected && (
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          To have families set up Direct Debit when they sign up, connect Stripe or GoCardless on the <a href="/payments">Payments</a> page.
        </p>
      )}
    </section>
  );
}
