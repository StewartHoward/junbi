import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listLeads } from "@/data/leads";
import { LeadStatusPill, STATUS_LABEL, sessionText } from "./LeadBits";

export const metadata: Metadata = { title: "Leads" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "booked", label: "Trial booked" },
  { key: "attended", label: "Came to trial" },
  { key: "converted", label: "Joined" },
  { key: "lost", label: "Not joining" },
  { key: "all", label: "All" },
] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "students.view")) redirect("/today");
  const [{ leads, counts, conversion }, sp] = await Promise.all([listLeads(actor), searchParams]);
  const show = FILTERS.some((f) => f.key === sp.show) ? sp.show! : "open";
  const shown = leads.filter((l) => (show === "all" ? true : show === "open" ? ["new", "booked", "attended"].includes(l.status) : l.status === show));
  const canAdd = can(actor, "students.edit");

  if (leads.length === 0) {
    return (
      <>
        <h1 className="page-title">Leads</h1>
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Keep track of who&apos;s interested.</h2>
          <p>Add anyone who rings, messages or walks in. They get a welcome email straight away and a reminder before their trial, and show as joined the moment they sign up.</p>
          {canAdd && <Link className="btn primary" href="/leads/new">Add a lead</Link>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <h1 className="page-title">Leads</h1>
        {canAdd && <Link className="btn primary" href="/leads/new">Add a lead</Link>}
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <div className="card stat"><div className="label">New</div><div className="value">{counts.new}</div></div>
        <div className="card stat"><div className="label">Trial booked</div><div className="value">{counts.booked}</div></div>
        <div className="card stat"><div className="label">Came to trial</div><div className="value">{counts.attended}</div></div>
        <div className="card stat"><div className="label">Joined</div><div className="value">{counts.converted}</div></div>
        {conversion !== null && <div className="card stat"><div className="label">Joined, last 90 days</div><div className="value">{conversion}%</div></div>}
      </div>

      <nav className="tabs" aria-label="Filter leads">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/leads?show=${f.key}`} aria-current={show === f.key ? "page" : undefined}>{f.label}</Link>
        ))}
      </nav>

      <div className="card table-wrap" style={{ marginTop: 16, padding: "8px 24px" }}>
        <table className="data" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Trial</th>
              <th scope="col">Heard about you</th>
              <th scope="col">Status</th>
              <th scope="col">Added</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/leads/${l.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{l.firstName} {l.lastName}</Link>
                  {l.studentName && <span className="muted"> · for {l.studentName}{l.studentAge ? ` (${l.studentAge})` : ""}</span>}
                </td>
                <td>{sessionText(l.sessionAt) ?? <span className="muted">Not booked</span>}{l.className ? <span className="muted"> · {l.className}</span> : null}</td>
                <td className="muted">{l.source ?? ""}</td>
                <td><LeadStatusPill status={l.status} /></td>
                <td className="muted">{l.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="muted">No leads here. {show !== "all" && <Link href="/leads?show=all">See all</Link>}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Leads show as {STATUS_LABEL.converted.toLowerCase()} automatically when the family signs up with your link or QR code using the same email or phone number.
      </p>
    </>
  );
}
