import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { canSeeEvents, getEvent } from "@/data/events";
import { addBookingAction, bookingStatusAction, cancelEventAction, inviteAction, resultsAction } from "../actions";
import { AddBookingForm, InviteForm, ResultsForm } from "./EventForms";
import { ringColour } from "@/components/ringColour";
import { todayISO } from "@/data/classes";

export const metadata: Metadata = { title: "Grading or event" };

const STATUS: Record<string, { label: string; tone: string }> = {
  invited: { label: "Invited", tone: "neutral" },
  pending: { label: "Paying now", tone: "neutral" },
  booked: { label: "✓ Booked", tone: "ok" },
  paid: { label: "✓ Paid", tone: "ok" },
  declined: { label: "Not coming", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
const OUTCOME: Record<string, string> = { pass: "✓ Pass", merit: "✓ Pass, merit", distinction: "✓ Pass, distinction", fail: "Not yet" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!canSeeEvents(actor)) redirect("/today");
  const e = await getEvent(actor, (await params).id);
  if (!e) notFound();
  const grading = e.kind === "grading";
  const going = e.bookings.filter((b) => b.status === "booked" || b.status === "paid");
  const others = e.bookings.filter((b) => b.status !== "booked" && b.status !== "paid");
  const passed = going.filter((b) => b.outcome && b.outcome !== "fail").length;
  const resultsOpen = grading && e.canRecord && !e.cancelled && e.date <= todayISO();

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/events">Gradings and events</Link> › {e.title}</p>
      <div className="head" style={{ marginTop: 8 }}>
        <div>
          <h1 className="page-title">{e.title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {e.when}{e.site ? ` · ${e.site}` : ""}{grading && e.art ? ` · ${e.art}` : ""}{e.location ? ` · ${e.location}` : ""}
          </p>
        </div>
      </div>
      {e.cancelled && <p className="banner" role="status" style={{ marginTop: 16 }}>This has been cancelled. Booking links no longer work.</p>}

      <div className="tiles" style={{ marginTop: 16 }}>
        <div className="tile"><p className="l">Going</p><p className="v">{e.going}{e.capacity ? <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> of {e.capacity}</span> : null}</p></div>
        <div className="tile"><p className="l">Fee</p><p className="v sm">{e.fee ? `${e.fee} each` : "Free"}</p></div>
        {e.collectedPence !== null && <div className="tile"><p className="l">Paid so far</p><p className="v sm">£{(e.collectedPence / 100).toFixed(2)}</p></div>}
        {grading && e.examiner && <div className="tile"><p className="l">Examiner</p><p className="v sm">{e.examiner}</p></div>}
      </div>
      {e.notes && <p style={{ marginTop: 12, fontSize: 15 }}>{e.notes}</p>}

      {resultsOpen && going.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <div className="ch"><h2>Results</h2><span className="m">{passed} passed</span></div>
          <ResultsForm action={resultsAction.bind(null, e.id)} bookings={going.map((b) => ({ id: b.id, name: b.name, grade: b.grade, outcome: b.outcome }))} />
        </section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <div className="ch"><h2>Who&apos;s coming</h2><span className="m">{going.length}</span></div>
        {e.bookings.length === 0 ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>No one yet. Invite students below.</p>
        ) : (
          <div className="lrows" style={{ marginTop: 8 }}>
            {[...going, ...others].map((b) => (
              <div key={b.id} className="lrow" style={{ flexWrap: "wrap", gap: 10 }}>
                {grading && b.beltColour && <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: ringColour(b.beltColour), border: "1px solid var(--line)", flex: "none" }} />}
                <span className="grow" style={{ minWidth: 160 }}>
                  <Link className="b" href={`/students?id=${b.studentId}`}>{b.name}</Link>
                  <span className="sub">{grading && b.grade ? `For ${b.grade}` : ""}{b.outcome ? `${grading && b.grade ? " · " : ""}${OUTCOME[b.outcome]}` : ""}</span>
                </span>
                <span className={`pill ${STATUS[b.status]?.tone ?? "neutral"}`}>{STATUS[b.status]?.label ?? b.status}</span>
                {e.canManage && !e.cancelled && (b.status === "booked" || b.status === "invited") && e.fee && (
                  <form action={bookingStatusAction.bind(null, e.id)}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="status" value="paid" />
                    <button className="btn ghost sm">Mark paid</button>
                  </form>
                )}
                {e.canManage && !e.cancelled && b.status !== "cancelled" && b.status !== "declined" && !b.outcome && (
                  <form action={bookingStatusAction.bind(null, e.id)}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <button className="btn ghost sm" aria-label={`Take ${b.name} off`}>Take off</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        {e.canManage && !e.cancelled && <AddBookingForm action={addBookingAction.bind(null, e.id)} candidates={e.candidates} fee={e.fee} />}
      </section>

      {e.canManage && !e.cancelled && !e.past && (
        <section className="card" style={{ marginTop: 20 }}>
          <div className="ch"><h2>Invite</h2></div>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
            {grading
              ? "Students who've done the classes needed for their next belt are marked Ready and ticked for you. Each family gets one email to book"
              : "Each family gets one email to book"}
            {e.fee ? " and pay by card." : "."}
          </p>
          <InviteForm action={inviteAction.bind(null, e.id)} candidates={e.candidates} grading={grading} />
        </section>
      )}

      {e.canManage && !e.cancelled && !e.past && (
        <details style={{ marginTop: 24 }}>
          <summary className="btn ghost" style={{ listStyle: "none" }}>Cancel this {grading ? "grading" : "event"}</summary>
          <form action={cancelEventAction.bind(null, e.id)} style={{ marginTop: 10 }}>
            <p className="muted" style={{ fontSize: 14, marginBottom: 8 }}>Booking links stop working and it can&apos;t be undone. Refund anyone who paid from your Stripe dashboard, and let families know.</p>
            <button className="btn secondary">Yes, cancel it</button>
          </form>
        </details>
      )}
    </>
  );
}
