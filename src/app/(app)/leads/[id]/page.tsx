import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { getLead, leadOptions } from "@/data/leads";
import { bookLeadAction, deleteLeadAction, sendLeadSignupAction, setLeadStatusAction } from "../actions";
import { LeadStatusPill, sessionText } from "../LeadBits";
import { BookForm } from "./BookForm";

export const metadata: Metadata = { title: "Lead" };

const when = (d: Date | null) => (d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : null);

function StatusButton({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={setLeadStatusAction}>
      <input type="hidden" name="leadId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn ${primary ? "primary" : "secondary"}`}>{label}</button>
    </form>
  );
}

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; linked?: string; linkError?: string }> }) {
  const actor = await requireActor();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const l = await getLead(actor, id);
  if (!l) notFound();
  const edit = can(actor, "students.edit");
  const opts = edit ? await leadOptions(actor) : null;
  const open = l.status !== "converted";

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/leads">Leads</Link> › {l.firstName} {l.lastName}</p>
      <header style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <h1 className="page-title">{l.firstName} {l.lastName}</h1>
        <LeadStatusPill status={l.status} />
      </header>

      {sp.added && <p className="banner" role="status" style={{ marginTop: 16 }}>Lead added.{sp.added === "emailed" ? " We've sent them a welcome email." : ""}</p>}
      {sp.linked && <p className="banner" role="status" style={{ marginTop: 16 }}>Sign-up link emailed to {l.email}.</p>}
      {sp.linkError && <p className="banner" role="alert" style={{ marginTop: 16 }}>That email couldn&apos;t be sent. Check the address and try again.</p>}

      {l.status === "converted" && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title">Joined</h2>
          <p style={{ marginTop: 8 }}>
            Signed up {when(l.convertedAt)}.{" "}
            {l.convertedStudentId && <Link href={`/students/${l.convertedStudentId}`}>Open {l.student ?? "their profile"}</Link>}
          </p>
        </section>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <section className="card" style={{ flex: "2 1 420px" }}>
          <h2 className="section-title">Details</h2>
          <div className="list" style={{ marginTop: 10 }}>
            <div><span className="muted">Email</span><span>{l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : "None"}</span></div>
            <div><span className="muted">Phone</span><span>{l.phone ? <a href={`tel:${l.phone.replace(/\s/g, "")}`}>{l.phone}</a> : "None"}</span></div>
            <div><span className="muted">Training</span><span>{l.studentName ? `${l.studentName}${l.studentAge ? `, age ${l.studentAge}` : ""}` : `${l.firstName}${l.studentAge ? `, age ${l.studentAge}` : ""}`}</span></div>
            <div><span className="muted">Site</span><span>{l.site ?? "Any"}</span></div>
            <div><span className="muted">Heard about you</span><span>{l.source ?? "Not sure"}</span></div>
            <div><span className="muted">Added</span><span>{when(l.createdAt)}</span></div>
          </div>
          {l.notes && <p style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{l.notes}</p>}
        </section>

        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card">
            <h2 className="section-title">Trial session</h2>
            <p style={{ marginTop: 8 }}>{sessionText(l.sessionAt) ?? <span className="muted">Not booked yet</span>}</p>
            {l.className && <p className="muted" style={{ fontSize: 14 }}>{l.className}</p>}
            {edit && open && opts && (
              <div style={{ marginTop: 14 }}>
                <BookForm action={bookLeadAction.bind(null, l.id)} classes={opts.classes} siteId={l.siteId} label={l.sessionAt ? "Change trial" : "Book a trial"} />
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="section-title">Emails</h2>
            <div className="list" style={{ marginTop: 10 }}>
              <div><span className="muted">Welcome</span><span>{l.welcomeSentAt ? `Sent ${when(l.welcomeSentAt)}` : l.email ? "Not sent" : "No email address"}</span></div>
              <div>
                <span className="muted">Trial reminder</span>
                <span>{l.reminderSentAt ? `Sent ${when(l.reminderSentAt)}` : !l.email ? "No email address" : l.sessionAt && open ? "The day before" : "When a trial is booked"}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {edit && open && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title">Next step</h2>
          <div className="actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {l.email && (
              <form action={sendLeadSignupAction}>
                <input type="hidden" name="leadId" value={l.id} />
                <button className="btn primary">Email them the sign-up link</button>
              </form>
            )}
            {l.status !== "attended" && <StatusButton id={l.id} status="attended" label="Came to trial" />}
            {l.status !== "lost" ? <StatusButton id={l.id} status="lost" label="Not joining" /> : <StatusButton id={l.id} status={l.sessionAt ? "booked" : "new"} label="Reopen" />}
            <Link className="btn secondary" href={`/students/new?lead=${l.id}`}>Add as a student</Link>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>When they sign up with your link, or you add them as a student with the same email or phone, this lead shows as joined by itself.</p>
        </section>
      )}

      {edit && (
        <form action={deleteLeadAction} style={{ marginTop: 20 }}>
          <input type="hidden" name="leadId" value={l.id} />
          <button className="btn ghost">Delete this lead</button>
        </form>
      )}
    </>
  );
}
