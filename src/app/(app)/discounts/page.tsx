import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listDiscounts } from "@/data/discounts";
import { listPlans } from "@/data/payments";
import { DiscountForm } from "./DiscountForm";
import { CopyCode } from "./CopyCode";
import { deleteDiscountAction, setDiscountActiveAction } from "./actions";

export const metadata: Metadata = { title: "Discounts" };

const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function DiscountsPage() {
  const actor = await requireActor();
  if (!can(actor, "payments.manage")) redirect("/today");
  const [codes, plans] = await Promise.all([listDiscounts(actor), listPlans(actor)]);

  return (
    <>
      <h1 className="page-title">Discounts</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
        Make codes that take a percentage off membership fees. Families type the code in when they sign up with your link or QR code, and the
        discount stays on their membership for as long as it runs. The sign-up fee isn&apos;t discounted.
      </p>
      {plans.plans.length === 0 && (
        <p className="banner" style={{ marginTop: 16 }}>
          Families can only use codes once you&apos;ve set membership prices. <Link href="/payments#prices">Add your prices</Link>
        </p>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">New code</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
          A code for everyone, like an open day offer, or a one-off code for a single family, like a staff child or a returning member.
        </p>
        <div style={{ marginTop: 16 }}><DiscountForm /></div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Your codes</h2>
        {codes.length === 0 ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>No codes yet.</p>
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {codes.map((c) => (
              <div key={c.id} style={{ flexWrap: "wrap", opacity: c.blocked ? 0.7 : 1 }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", letterSpacing: "0.02em" }}>{c.code}</strong>
                  <span className="pill hong" style={{ marginLeft: 8 }}>{c.percent}% off</span>
                  {c.blocked && <span className="pill neutral" style={{ marginLeft: 6 }}>{c.blocked}</span>}
                  <span className="muted" style={{ display: "block", fontSize: 13, marginTop: 4 }}>
                    {[
                      c.note,
                      c.maxUses === 1 ? (c.uses ? "Used" : "One family") : c.maxUses ? `${c.uses} of ${c.maxUses} used` : `Used ${c.uses} ${c.uses === 1 ? "time" : "times"}`,
                      c.members ? `${c.members} ${c.members === 1 ? "member" : "members"} on it now` : null,
                      c.expiresOn ? `Use by ${date(c.expiresOn)}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="actions">
                  <CopyCode code={c.code} />
                  <form action={setDiscountActiveAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                    <button className="btn ghost">{c.active ? "Switch off" : "Switch on"}</button>
                  </form>
                  {!c.active && (
                    <form action={deleteDiscountAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn ghost" title="Families already using it keep their discount">Delete</button>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Switching a code off or deleting it stops new families using it. Anyone already on it keeps their discount.</p>
      </section>
    </>
  );
}
