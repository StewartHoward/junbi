"use client";

import { useActionState, useMemo, useState } from "react";
import { takeOverAction, type TakeoverState } from "../actions";
import type { TakeoverRow } from "@/data/stripe-own";

type Plan = { id: string; name: string; amountPence: number; interval: string };

const money = (p: number) => `£${(p / 100).toFixed(2)}`;
const every = (i: string) => (i === "annual" ? "a year" : i === "monthly" ? "a month" : "");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function TakeoverForm({ rows, plans }: { rows: TakeoverRow[]; plans: Plan[] }) {
  const [state, action, pending] = useActionState<TakeoverState, FormData>(takeOverAction, {});
  const ready = rows.filter((r) => r.canTakeOver && r.household && r.household.students.length);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [student, setStudent] = useState<Record<string, string>>(() => Object.fromEntries(ready.map((r) => [r.subscriptionId, r.household!.students.length === 1 ? r.household!.students[0].id : ""])));
  const [plan, setPlan] = useState<Record<string, string>>(() => Object.fromEntries(ready.map((r) => [r.subscriptionId, r.suggestedPlanId ?? ""])));
  const [reviewing, setReviewing] = useState(false);

  const chosen = useMemo(() => ready.filter((r) => picked[r.subscriptionId]), [ready, picked]);
  const incomplete = chosen.filter((r) => !student[r.subscriptionId] || !plan[r.subscriptionId]);
  const planOf = (id: string) => plans.find((p) => p.id === plan[id]);

  if (state.results) {
    const ok = state.results.filter((r) => r.ok).length;
    return (
      <div>
        <p className="banner" role="status">{ok} of {state.results.length} taken over.</p>
        <div className="list" style={{ marginTop: 12 }}>
          {state.results.map((r) => {
            const row = rows.find((x) => x.subscriptionId === r.subscriptionId);
            return (
              <div key={r.subscriptionId}>
                <span><strong>{row?.customerName ?? r.subscriptionId}</strong></span>
                <span className={`pill ${r.ok ? "ok" : "bad"}`}>{r.message}</span>
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: 16 }}><a className="btn secondary" href="/payments/takeover">Back to the list</a></p>
      </div>
    );
  }

  return (
    <form action={action}>
      {chosen.map((r) => (
        <span key={r.subscriptionId}>
          <input type="hidden" name="pick" value={r.subscriptionId} />
          <input type="hidden" name={`student_${r.subscriptionId}`} value={student[r.subscriptionId] ?? ""} />
          <input type="hidden" name={`plan_${r.subscriptionId}`} value={plan[r.subscriptionId] ?? ""} />
        </span>
      ))}

      {!reviewing ? (
        <>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Take over</span></th>
                  <th scope="col">Family in Stripe</th>
                  <th scope="col">Paying now</th>
                  <th scope="col">Next payment</th>
                  <th scope="col">Student in Junbi</th>
                  <th scope="col">Junbi price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = ready.includes(r);
                  return (
                    <tr key={r.subscriptionId}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Take over ${r.customerName}`}
                          disabled={!ok}
                          checked={!!picked[r.subscriptionId]}
                          onChange={(e) => setPicked((p) => ({ ...p, [r.subscriptionId]: e.target.checked }))}
                        />
                      </td>
                      <td>
                        <strong>{r.customerName}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>{r.email ?? "No email"}{r.description ? ` · ${r.description}` : ""}</div>
                      </td>
                      <td className="num">
                        {money(r.amountPence)} {every(r.interval)}
                        <div className="muted" style={{ fontSize: 12 }}>{r.method}</div>
                      </td>
                      <td className="num">{day(r.nextPaymentOn)}</td>
                      <td>
                        {!r.canTakeOver ? (
                          <span className="muted" style={{ fontSize: 13 }}>{r.reason}</span>
                        ) : !r.household ? (
                          <span className="muted" style={{ fontSize: 13 }}>No family in Junbi with this email</span>
                        ) : !r.household.students.length ? (
                          <span className="muted" style={{ fontSize: 13 }}>{r.household.name} has no students yet</span>
                        ) : (
                          <select aria-label={`Student for ${r.customerName}`} value={student[r.subscriptionId] ?? ""} onChange={(e) => setStudent((s) => ({ ...s, [r.subscriptionId]: e.target.value }))}>
                            <option value="">Choose</option>
                            {r.household.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {ok && (
                          <select aria-label={`Price for ${r.customerName}`} value={plan[r.subscriptionId] ?? ""} onChange={(e) => setPlan((s) => ({ ...s, [r.subscriptionId]: e.target.value }))}>
                            <option value="">Choose</option>
                            {plans.filter((p) => p.interval !== "termly").map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.amountPence)} {every(p.interval)}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={() => setPicked(Object.fromEntries(ready.map((r) => [r.subscriptionId, true])))}>Select all ready</button>
            <button type="button" className="btn primary" disabled={!chosen.length || incomplete.length > 0} onClick={() => setReviewing(true)}>
              Review {chosen.length || ""} {chosen.length === 1 ? "family" : "families"}
            </button>
          </div>
          {incomplete.length > 0 && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>Choose a student and a price for each family you&apos;ve ticked.</p>}
        </>
      ) : (
        <>
          <h2 className="section-title">Check before you confirm</h2>
          <div className="list" style={{ marginTop: 10 }}>
            {chosen.map((r) => {
              const p = planOf(r.subscriptionId)!;
              const s = r.household!.students.find((x) => x.id === student[r.subscriptionId]);
              const changes = p.amountPence !== r.amountPence || p.interval !== r.interval;
              return (
                <div key={r.subscriptionId} style={{ flexWrap: "wrap" }}>
                  <span>
                    <strong>{s?.name}</strong> <span className="muted">({r.customerName})</span>
                    <br />
                    <span className="muted" style={{ fontSize: 13 }}>
                      From {day(r.nextPaymentOn)}: {p.name}, {money(p.amountPence)} {every(p.interval)}
                    </span>
                  </span>
                  {changes ? <span className="pill warn">Changes from {money(r.amountPence)} {every(r.interval)}</span> : <span className="pill ok">Same amount</span>}
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 14, maxWidth: 680 }}>
            For each family, Junbi starts its own payment on the same saved Direct Debit or card from their next payment date, and their old
            payment stops on that date. Nothing extra is charged and parents don&apos;t need to do anything. If the amount changes, let the family
            know before their next payment.
          </p>
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn primary" disabled={pending}>{pending ? "Taking over…" : `Confirm and take over ${chosen.length}`}</button>
            <button type="button" className="btn ghost" onClick={() => setReviewing(false)}>Back</button>
          </div>
          {state.errors?.form && <p className="banner" role="alert" style={{ marginTop: 12 }}>{state.errors.form}</p>}
        </>
      )}
    </form>
  );
}
