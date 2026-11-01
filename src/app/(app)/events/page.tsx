import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { canSeeEvents, listEvents } from "@/data/events";

export const metadata: Metadata = { title: "Gradings and events" };

type Row = Awaited<ReturnType<typeof listEvents>>["upcoming"][number];

function EventRow({ e }: { e: Row }) {
  return (
    <Link href={`/events/${e.id}`} className="lrow" style={{ textDecoration: "none", color: "inherit" }}>
      <span className="grow">
        <b>{e.title}</b>
        {e.cancelled && <span className="pill neutral" style={{ marginLeft: 8 }}>Cancelled</span>}
        <span className="sub">{e.when}{e.site ? ` · ${e.site}` : ""}{e.art && e.kind === "grading" ? ` · ${e.art}` : ""}</span>
      </span>
      <span className="muted" style={{ fontSize: 14, textAlign: "right" }}>
        {e.going} going{e.capacity ? ` of ${e.capacity}` : ""}
        {e.invited > 0 && <span className="sub">{e.invited} not replied</span>}
      </span>
    </Link>
  );
}

export default async function EventsPage() {
  const actor = await requireActor();
  if (!canSeeEvents(actor)) redirect("/today");
  const { upcoming, past } = await listEvents(actor);
  const manage = can(actor, "classes.manage");
  return (
    <>
      <div className="head">
        <h1 className="page-title">Gradings and events</h1>
        {manage && (
          <div className="actions" style={{ flexWrap: "wrap" }}>
            <Link className="btn primary" href="/events/new?kind=grading">Set up a grading</Link>
            <Link className="btn secondary" href="/events/new?kind=event">Set up an event</Link>
          </div>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Run your gradings here.</h2>
          <p>Set up a grading and Junbi picks out who&apos;s ready for their next belt. Families book and pay online, you record the results, and the new belts and certificates are done for you.</p>
          {manage && <Link className="btn primary" href="/events/new?kind=grading">Set up a grading</Link>}
        </div>
      ) : (
        <>
          <section className="card" style={{ marginTop: 24 }}>
            <h2 className="section-title">Coming up</h2>
            {upcoming.length ? <div className="lrows" style={{ marginTop: 8 }}>{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</div> : <p className="muted" style={{ marginTop: 8 }}>Nothing coming up.</p>}
          </section>
          {past.length > 0 && (
            <section className="card" style={{ marginTop: 20 }}>
              <h2 className="section-title">Past</h2>
              <div className="lrows" style={{ marginTop: 8 }}>{past.map((e) => <EventRow key={e.id} e={e} />)}</div>
            </section>
          )}
        </>
      )}
    </>
  );
}
