import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { listMessages } from "@/data/messages";

export const metadata: Metadata = { title: "Messages" };

const when = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default async function MessagesPage() {
  const actor = await requireActor();
  if (!can(actor, "messages.send")) redirect("/today");
  const messages = await listMessages(actor);

  if (messages.length === 0) {
    return (
      <>
        <h1 className="page-title">Messages</h1>
        <div className="card empty" style={{ marginTop: 24 }}>
          <h2>Email your families.</h2>
          <p>Send a message to everyone, one site, or the families of a class. Replies come straight back to you.</p>
          <Link className="btn primary" href="/messages/new">Write a message</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <h1 className="page-title">Messages</h1>
        <Link className="btn primary" href="/messages/new">New message</Link>
      </div>
      <div className="card table-wrap" style={{ marginTop: 24, padding: "8px 24px" }}>
        <table className="data" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th scope="col">Message</th>
              <th scope="col">Sent to</th>
              <th scope="col">Families</th>
              <th scope="col">Sent</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/messages/${m.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{m.subject}</Link>
                  {m.failedCount > 0 && <span className="pill warn" style={{ marginLeft: 8 }}>{m.failedCount} not sent</span>}
                </td>
                <td>{m.audienceLabel}</td>
                <td className="num">{m.recipientCount}</td>
                <td className="muted">
                  {when(m.createdAt)}
                  {m.sender ? ` · ${m.sender.split(" ")[0]}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
