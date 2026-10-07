import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { classesOn, todayISO, CLUB_TZ } from "@/data/classes";
import { clubArts, getClubOverview } from "@/data/club";
import { ArtFilter } from "@/components/ArtFilter";
import { disciplineName } from "@/lib/disciplines";

export const metadata: Metadata = { title: "Today" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: CLUB_TZ }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ art?: string }> }) {
  const actor = await requireActor();
  const { art } = await searchParams;
  const arts = await clubArts(actor);
  const filter = art && arts.includes(art) ? art : undefined;
  const date = todayISO();
  const [classes, overview] = await Promise.all([classesOn(actor, date, { discipline: filter }), getClubOverview(actor)]);
  const checkedIn = classes.reduce((n, c) => n + c.present, 0);
  const trialDays = overview.club.trialEndsOn
    ? Math.round((Date.parse(`${overview.club.trialEndsOn}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000)
    : null;
  const nice = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const gettingStarted = [
    { done: overview.activeStudents > 0, label: "Add your students", href: "/students/new", show: can(actor, "students.edit") },
    { done: overview.classCount > 0, label: "Build your timetable", href: "/classes/new", show: can(actor, "classes.manage") },
  ];

  return (
    <>
      <p className="muted">{nice}</p>
      <h1 className="page-title" style={{ marginTop: 4 }}>
        {greeting()}, {actor.userName.split(" ")[0]}.
      </h1>
      <ArtFilter arts={arts} current={filter} basePath="/today" />

      {trialDays !== null && trialDays >= 0 && can(actor, "club.manage") && (
        <p className="banner" style={{ marginTop: 20 }}>
          {trialDays === 0 ? "Your free trial ends today." : `${trialDays} ${trialDays === 1 ? "day" : "days"} left in your free trial.`}
          {overview.club.founding ? " As a Founding Club you'll get 50% off for six months after that." : ""}
        </p>
      )}

      <div className="row" style={{ marginTop: 24 }}>
        <div className="card stat">
          <div className="label">Active students</div>
          <div className="value">{overview.activeStudents}</div>
        </div>
        <div className="card stat">
          <div className="label">Classes today</div>
          <div className="value">{classes.length}</div>
        </div>
        <div className="card stat">
          <div className="label">Checked in today</div>
          <div className="value">{checkedIn}</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="head">
          <h2 className="section-title">Today&apos;s classes</h2>
          <Link href="/classes">Full timetable</Link>
        </div>
        {classes.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No classes on the timetable today.{" "}
            {can(actor, "classes.manage") && <Link href="/classes/new">Add a class</Link>}
          </p>
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {classes.map((c) => (
              <div key={c.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    <span className="num">{c.startsAt.slice(0, 5)}</span> {c.name}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {c.site}
                    {arts.length > 1 ? ` · ${disciplineName(c.discipline)}` : ""} · {c.present} checked in
                  </div>
                </div>
                <Link className="btn secondary" href={`/classes/${c.id}/register?date=${date}`}>
                  Take register
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {gettingStarted.some((g) => g.show && !g.done) && (
        <section className="card" style={{ marginTop: 24 }}>
          <h2 className="section-title">Getting started</h2>
          <div className="list" style={{ marginTop: 8 }}>
            {gettingStarted
              .filter((g) => g.show)
              .map((g) => (
                <div key={g.label}>
                  <span>{g.done ? "✓ " : ""}{g.label}</span>
                  {!g.done && <Link href={g.href}>Start</Link>}
                </div>
              ))}
          </div>
        </section>
      )}
    </>
  );
}
