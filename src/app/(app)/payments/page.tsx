import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { paymentSettings } from "@/data/payments";
import { formatPence } from "@/data/students";
import { disconnectAction } from "./actions";
import { PricesCard } from "./PricesCard";

export const metadata: Metadata = { title: "Payments" };

const NAMES = { stripe: "Stripe", gocardless: "GoCardless" } as const;
const OPTIONS = [
  { id: "stripe", name: "Stripe", text: "Direct Debit, with cards and Apple Pay on the same account. Set up in about ten minutes; if you already use Stripe, sign in and your details fill in for you." },
  { id: "gocardless", name: "GoCardless", text: "Direct Debit specialists. Good if you already collect through GoCardless, as your existing account connects in one click." },
] as const;

const STATUS: Record<string, string> = {
  pending: "Pending", submitted: "Submitted", confirmed: "Collected", paid_out: "Paid out",
  retrying: "Retrying", failed: "Failed", charged_back: "Charged back", cancelled: "Cancelled",
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "payments.view")) redirect("/today");
  const owner = can(actor, "club.manage");
  const manage = can(actor, "payments.manage");
  const [p, sp] = await Promise.all([paymentSettings(actor), searchParams]);
  const live = Object.entries(p.mandates).filter(([k]) => ["active", "submitted", "pending_submission"].includes(k)).reduce((n, [, c]) => n + c, 0);
  const problems = (p.mandates.failed ?? 0) + (p.mandates.cancelled ?? 0) + (p.mandates.expired ?? 0);

  return (
    <>
      <h1 className="page-title">Payments</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
        Families pay by Direct Debit into your own Stripe or GoCardless account. Junbi never touches the money and takes 0%.
      </p>

      {sp.connected && <p className="banner" role="status" style={{ marginTop: 16 }}>{NAMES[sp.connected as keyof typeof NAMES] ?? "Your account"} is connected.</p>}
      {sp.error && (
        <p className="banner" role="alert" style={{ marginTop: 16 }}>
          {sp.error === "cancelled" ? "Connecting was cancelled." : sp.error === "unavailable" ? "That isn't available on Junbi just yet." : sp.error}
        </p>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <h2 className="section-title">How families pay</h2>
        {p.account ? (
          <div className="list" style={{ marginTop: 8 }}>
            <div>
              <span>
                <strong>{NAMES[p.account.provider as keyof typeof NAMES]}</strong>
                <span className="muted" style={{ fontSize: 13 }}> · connected {p.account.connectedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </span>
              {owner && (
                <form action={disconnectAction}>
                  <button className="btn ghost">Disconnect</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Choose one. You can switch later, and families already paying carry on as they are.</p>
            <div className="row" style={{ marginTop: 12 }}>
              {OPTIONS.map((o) => (
                <div key={o.id} className="card" style={{ flex: "1 1 260px", boxShadow: "none", border: "1px solid var(--line)" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600 }}>{o.name}</h3>
                  <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{o.text}</p>
                  <div style={{ marginTop: 14 }}>
                    {!owner ? (
                      <span className="muted" style={{ fontSize: 13 }}>Ask the club owner to connect.</span>
                    ) : p.available[o.id] ? (
                      <a className="btn primary" href={`/api/payments/connect/${o.id}`}>Connect {o.name}</a>
                    ) : (
                      <span className="pill neutral">Coming soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Don&apos;t have either yet? Connecting takes you to sign up, which takes about ten minutes.</p>
          </>
        )}
      </section>

      <PricesCard plans={p.plans} manage={manage} connected={Boolean(p.account)} signupFeePence={p.signupFeePence} />

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Direct Debits</h2>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="card stat"><div className="label">Families paying</div><div className="value">{live}</div></div>
          <div className="card stat"><div className="label">Need attention</div><div className="value">{problems}</div></div>
        </div>
        {p.recent.length === 0 ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>No payments yet. They&apos;ll appear here as families pay.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data" style={{ minWidth: 480 }}>
              <thead>
                <tr><th scope="col">Family</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {p.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.family}</td>
                    <td className="num">{new Date(`${r.chargeDate}T12:00:00Z`).toLocaleDateString("en-GB")}</td>
                    <td className="num">{formatPence(r.amountPence)}</td>
                    <td><span className={`pill ${r.status === "failed" || r.status === "charged_back" ? "bad" : r.status === "confirmed" || r.status === "paid_out" ? "ok" : "neutral"}`}>{STATUS[r.status] ?? r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
