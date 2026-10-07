import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { ForbiddenError } from "@/auth/permissions";
import { addDays, getRegister, validDate } from "@/data/classes";
import { toggleAttendanceAction } from "../../../actions";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const date = validDate((await searchParams).date);
  const reg = await getRegister(actor, id, date).catch((e: unknown) => {
    if (e instanceof ForbiddenError) return null;
    throw e;
  });
  if (!reg) notFound();
  const { cls } = reg;
  const nice = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/classes">Classes</Link> › {cls.name}
      </p>
      <div className="head" style={{ marginTop: 12 }}>
        <div>
          <h1 className="page-title">{cls.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {nice} · <span className="num">{cls.startsAt.slice(0, 5)}</span> · {cls.site}
          </p>
        </div>
        <nav className="actions" aria-label="Change week">
          <Link className="btn ghost" href={`/classes/${cls.id}/register?date=${addDays(date, -7)}`}>‹ Last week</Link>
          <Link className="btn ghost" href={`/classes/${cls.id}/register?date=${addDays(date, 7)}`}>Next week ›</Link>
        </nav>
      </div>

      {!reg.runsToday && <p className="banner" style={{ marginTop: 16 }}>This class doesn&apos;t usually run on this day.</p>}

      <section className="card" style={{ marginTop: 20 }}>
        <div className="head">
          <h2 className="section-title">Register</h2>
          <span className="muted num" aria-live="polite">
            {reg.presentCount} of {reg.students.length} here
          </span>
        </div>
        {reg.students.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No active students at {cls.site} yet. <Link href="/students/new">Add a student</Link>
          </p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {reg.students.map((st) => (
              <form key={st.id} action={toggleAttendanceAction} className="register-row">
                <input type="hidden" name="classId" value={cls.id} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="studentId" value={st.id} />
                <input type="hidden" name="present" value={st.present ? "0" : "1"} />
                <span>
                  <strong>{st.firstName} {st.lastName}</strong>
                  {st.status === "trial" && <span className="pill neutral" style={{ marginLeft: 8 }}>Trial</span>}
                </span>
                <button type="submit" className={`btn tick ${st.present ? "on" : "secondary"}`} aria-pressed={st.present} aria-label={`${st.firstName} ${st.lastName}: ${st.present ? "here, tap to undo" : "mark as here"}`}>
                  {st.present ? "✓ Here" : "Mark here"}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
