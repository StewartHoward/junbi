"use client";

import { useActionState, useState } from "react";
import { bookAction, type BookState } from "./actions";
import type { BookingPage } from "@/data/events";

const money = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

/** Each invited person: coming or not. Then pay by card, or confirm. */
export function BookForm({ token, page }: { token: string; page: BookingPage }) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction.bind(null, token), {});
  const open = page.people.filter((p) => p.status === "invited" || p.status === "pending" || p.status === "declined");
  const [answer, setAnswer] = useState<Record<string, string>>(() => Object.fromEntries(open.map((p) => [p.bookingId, p.status === "declined" ? "no" : "yes"])));
  const coming = open.filter((p) => answer[p.bookingId] === "yes").length;
  const done = page.people.filter((p) => p.status === "booked" || p.status === "paid");

  if (state.confirmed || state.declinedOnly) {
    return (
      <div style={{ marginTop: 28 }}>
        <h2 className="m-h2" style={{ fontSize: 30 }}>{state.declinedOnly ? "Thanks for letting us know." : "You're booked."}</h2>
        <p className="m-sub" style={{ fontSize: 18 }}>
          {state.declinedOnly ? "The club can see you're not coming this time." : page.feePence ? `Please pay ${money(page.feePence * (state.confirmed ?? 1))} at the club before the day.` : "See you there."}
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="m-form" noValidate>
      {state.errors?.form && <p className="error" role="alert">{state.errors.form}</p>}
      {done.map((p) => (
        <div key={p.bookingId} className="m-person" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span><b>{p.name}</b>{p.grade ? <span style={{ display: "block", fontSize: 15, opacity: 0.75 }}>For {p.grade}</span> : null}</span>
          <span style={{ fontWeight: 600 }}>✓ {p.status === "paid" ? "Paid" : "Booked"}</span>
        </div>
      ))}
      {open.map((p) => (
        <fieldset key={p.bookingId} className="m-person">
          <legend style={{ fontSize: 17 }}>{p.name}{p.grade ? ` · for ${p.grade}` : ""}</legend>
          <div className="m-who">
            <label><input type="radio" name={`b_${p.bookingId}`} value="yes" checked={answer[p.bookingId] === "yes"} onChange={() => setAnswer((a) => ({ ...a, [p.bookingId]: "yes" }))} /> Coming</label>
            <label><input type="radio" name={`b_${p.bookingId}`} value="no" checked={answer[p.bookingId] === "no"} onChange={() => setAnswer((a) => ({ ...a, [p.bookingId]: "no" }))} /> Not this time</label>
          </div>
        </fieldset>
      ))}
      {open.length > 0 && (
        <>
          {page.full && coming > 0 ? <p className="error">Sorry, it&apos;s full.</p> : null}
          <p className="m-fine" style={{ margin: 0 }}>
            {coming && page.feePence ? `Total: ${money(page.feePence * coming)}. ` : ""}
            {coming && page.feePence ? (page.card ? "You'll pay by card on the next page, through the club's secure Stripe checkout." : "Pay at the club before the day.") : ""}
          </p>
          <button type="submit" className="m-btn primary" disabled={pending || (page.full && coming > 0)} style={{ alignSelf: "flex-start" }}>
            {pending ? "One moment…" : coming === 0 ? "Send" : page.feePence && page.card ? `Pay ${money(page.feePence * coming)}` : "Book"}
          </button>
        </>
      )}
    </form>
  );
}
