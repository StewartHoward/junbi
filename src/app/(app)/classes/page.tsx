import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listClasses, todayISO, isoWeekday, addDays, WEEKDAYS } from "@/data/classes";
import { clubArts } from "@/data/club";
import { ArtFilter } from "@/components/ArtFilter";
import { disciplineName } from "@/lib/disciplines";
import { archiveClassAction } from "../actions";

export const metadata: Metadata = { title: "Classes" };

/** The next date (today or later) a class on this weekday runs. */
function nextDate(weekday: number) {
  const today = todayISO();
  const diff = (weekday - isoWeekday(today) + 7) % 7;
  return addDays(today, diff);
}

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ art?: string }> }) {
  const actor = await requireActor();
  const { art } = await searchParams;
  const arts = await clubArts(actor);
  const filter = art && arts.includes(art) ? art : undefined;
  const classes = await listClasses(actor, { discipline: filter });
  const manage = can(actor, "classes.manage");

  return (
    <>
      <div className="head">
        <h1 className="page-title">Classes</h1>
        {manage && classes.length > 0 && <Link className="btn primary" href="/classes/new">Add class</Link>}
      </div>
      <ArtFilter arts={arts} current={filter} basePath="/classes" />

      {classes.length === 0 ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Build your timetable.</h2>
          <p>Add each weekly class once. Junbi then gives you a register for it every week.</p>
          {manage && <Link className="btn primary" href="/classes/new">Add a class</Link>}
        </div>
      ) : (
        WEEKDAYS.map((day, i) => {
          const list = classes.filter((c) => c.weekday === i + 1);
          if (!list.length) return null;
          return (
            <section key={day} className="card" style={{ marginTop: 20 }}>
              <h2 className="section-title">{day}</h2>
              <div className="list" style={{ marginTop: 8 }}>
                {list.map((c) => (
                  <div key={c.id}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        <span className="num">{c.startsAt.slice(0, 5)}</span> {c.name}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {c.site} · {c.durationMinutes} min{c.capacity ? ` · up to ${c.capacity}` : ""}
                        {arts.length > 1 ? ` · ${disciplineName(c.discipline)}` : ""}
                      </div>
                    </div>
                    <div className="actions">
                      <Link className="btn secondary" href={`/classes/${c.id}/register?date=${nextDate(c.weekday)}`}>
                        Register
                      </Link>
                      {manage && (
                        <form action={archiveClassAction}>
                          <input type="hidden" name="classId" value={c.id} />
                          <button type="submit" className="btn ghost" aria-label={`Remove ${c.name} on ${day}`}>Remove</button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
