import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { getMessage } from "@/data/messages";

export const metadata: Metadata = { title: "Message" };

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Sent", cls: "ok" },
  logged: { label: "Not delivered (email off)", cls: "neutral" },
  queued: { label: "Sending", cls: "neutral" },
  failed: { label: "Not sent", cls: "bad" },
};

export default async function MessagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "messages.send")) redirect("/today");
  const [{ id }, { sent }] = await Promise.all([params, searchParams]);
  const m = await getMessage(actor, id);
  if (!m) notFound();
  const paragraphs = m.body.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/messages">Messages</Link> › {m.subject}
      </p>
      {sent && (
        <p className="banner" role="status" style={{ marginTop: 16 }}>
          {m.failedCount ? `Sent to ${m.sentCount} of ${m.recipientCount} parents. ${m.failedCount} couldn't be sent, listed below.` : `Sent to ${m.recipientCount} ${m.recipientCount === 1 ? "parent" : "parents"}.`}
        </p>
      )}
      <h1 className="page-title" style={{ marginTop: 12 }}>{m.subject}</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        {m.audienceLabel} · {m.recipientCount} {m.recipientCount === 1 ? "parent" : "parents"} ·{" "}
        {m.createdAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
        {m.sender ? ` · by ${m.sender}` : ""}
      </p>
      <section className="card" style={{ marginTop: 20, maxWidth: 760 }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ marginTop: i ? 14 : 0, whiteSpace: "pre-line" }}>{p}</p>
        ))}
      </section>
      <section className="card table-wrap" style={{ marginTop: 20, padding: "8px 24px", maxWidth: 760 }}>
        <table className="data" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th scope="col">Family contact</th>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {m.recipients.map((r, i) => {
              const st = STATUS[r.status] ?? STATUS.queued;
              return (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td className="muted">{r.email}</td>
                  <td><span className={`pill ${st.cls}`} title={r.error ?? undefined}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <div className="actions" style={{ marginTop: 20 }}>
        <Link href="/messages/new" className="btn secondary">New message</Link>
      </div>
    </>
  );
}
