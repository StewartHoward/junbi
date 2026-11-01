import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { familyEmail, familyOverview } from "@/data/family";
import { familyDetailsAction, familySignOutAction } from "../actions";
import { DetailsForm } from "./DetailsForm";

export const metadata: Metadata = { title: "Your family", robots: { index: false, follow: false } };

const BELT: Record<string, string> = { white: "#f2f2f2", grey: "#8e8e93", yellow: "#f5c400", orange: "#f28c28", green: "#2e8b3d", blue: "#1f4fbf", purple: "#6b3fa0", brown: "#7a4a21", red: "#c8102e", black: "#111111" };
const DD: Record<string, string> = { active: "✓ Direct Debit active", submitted: "Direct Debit being set up", pending_submission: "Direct Debit being set up", pending_customer_approval: "Direct Debit waiting for you to confirm", cancelled: "Direct Debit cancelled", failed: "Direct Debit failed", expired: "Direct Debit expired" };
const PAY: Record<string, string> = { pending: "Pending", submitted: "Pending", confirmed: "✓ Paid", paid_out: "✓ Paid", failed: "Failed", retrying: "Retrying", cancelled: "Cancelled", charged_back: "Refunded" };

const card: React.CSSProperties = { border: "1px solid var(--m-line)", borderRadius: 18, padding: 20, marginTop: 16 };

/** The parent's home: one block per club, each child's belt, classes and plan, bookings, payments and details. */
export default async function FamilyHome() {
  const email = await familyEmail();
  if (!email) redirect("/family");
  const clubs = await familyOverview(email);
  if (!clubs.length) redirect("/family");
  return (
    <div className="m-auth" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <p className="m-eyebrow" style={{ margin: 0 }}>Signed in as {email}</p>
        <form action={familySignOutAction}><button className="m-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}>Sign out</button></form>
      </div>
      <h1 style={{ marginTop: 8 }}>Hi {clubs[0].me.firstName}.</h1>

      {clubs.map((c) => (
        <section key={c.householdId} style={{ marginTop: 36 }}>
          {clubs.length > 1 && <h2 className="m-h2" style={{ fontSize: 26, textAlign: "left" }}>{c.clubName}</h2>}

          {c.events.map((ev) => (
            <div key={ev.url} style={{ ...card, borderColor: ev.open.length ? "var(--m-action)" : "var(--m-line)" }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>{ev.title}</p>
              <p style={{ margin: "4px 0 0", opacity: 0.75 }}>{ev.when}</p>
              {ev.going.length > 0 && <p style={{ margin: "8px 0 0" }}>✓ Booked: {ev.going.join(", ")}</p>}
              {ev.open.length > 0 && (
                <p style={{ margin: "12px 0 0" }}>
                  <a className="m-btn primary" href={ev.url}>Book {ev.open.join(" and ")}</a>
                </p>
              )}
            </div>
          ))}

          {c.children.map((k) => (
            <div key={k.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 20 }}>{k.name}</p>
                <span style={{ opacity: 0.75 }}>{k.site}</span>
              </div>
              {k.pending && <p className="error" style={{ marginTop: 8 }}>Their place isn&apos;t confirmed until your Direct Debit is set up. Ask the club for a link if you need one.</p>}
              {k.belts.length ? (
                k.belts.map((b) => (
                  <p key={b.grade} style={{ margin: "10px 0 0", display: "flex", gap: 10, alignItems: "center" }}>
                    <span aria-hidden="true" style={{ width: 36, height: 10, borderRadius: 5, background: BELT[b.beltColour] ?? "#f2f2f2", border: "1px solid var(--m-line)" }} />
                    <span><b>{b.grade}</b> <span style={{ opacity: 0.75 }}>since {b.gradedOn}</span></span>
                  </p>
                ))
              ) : (
                <p style={{ margin: "10px 0 0", opacity: 0.75 }}>No belt yet.</p>
              )}
              <p style={{ margin: "8px 0 0" }}>{k.classesLast4Weeks} {k.classesLast4Weeks === 1 ? "class" : "classes"} in the last 4 weeks</p>
              {k.plan && <p style={{ margin: "4px 0 0", opacity: 0.75 }}>{k.plan}</p>}
              {k.classes.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer" }}>Class times</summary>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{k.classes.map((t) => <li key={t}>{t}</li>)}</ul>
                </details>
              )}
            </div>
          ))}

          {(c.directDebit || c.payments.length > 0) && (
            <div style={card}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Payments</p>
              {c.directDebit && <p style={{ margin: "6px 0 0" }}>{DD[c.directDebit] ?? c.directDebit}</p>}
              {c.payments.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {c.payments.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--m-line)" }}>
                      <span>{p.chargeDate} · {p.description}</span>
                      <span style={{ whiteSpace: "nowrap" }}>{p.amount} · {PAY[p.status] ?? p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {c.shopUrl && (
            <a href={c.shopUrl} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <span><b style={{ fontSize: 18 }}>Club shop</b><span style={{ display: "block", opacity: 0.75 }}>Uniforms, kit and more</span></span>
              <span aria-hidden="true">›</span>
            </a>
          )}

          <details style={card}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 18 }}>Your details</summary>
            <DetailsForm action={familyDetailsAction.bind(null, c.clubId, c.householdId)} phone={c.me.phone} contact={c.contact} children={c.children.map((k) => ({ id: k.id, firstName: k.firstName, medicalNotes: k.medicalNotes }))} />
          </details>
        </section>
      ))}
    </div>
  );
}
