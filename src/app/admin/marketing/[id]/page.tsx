import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/auth/admin";
import { getCampaign } from "@/data/marketing";
import { Controls, Editor } from "./Editor";

export const metadata: Metadata = { title: "Email · Junbi admin" };

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const STATUS: Record<string, string> = { draft: "Draft", sending: "Sending", paused: "Paused", sent: "Sent" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  const data = await getCampaign((await params).id);
  if (!data) notFound();
  const { campaign: c, stats, others, sample, recent } = data;
  return (
    <>
      <p style={{ margin: 0, fontSize: 14 }}><Link href="/admin/marketing">‹ Marketing</Link></p>
      <div className="phead" style={{ marginTop: 8 }}>
        <div>
          <p className="eyebrow">{STATUS[c.status]}{c.testSentAt ? ` · Test sent ${when(c.testSentAt)}` : " · No test sent for this version"}</p>
          <h1 className="ptitle">{c.name || "Untitled email"}</h1>
        </div>
      </div>

      <section className="kpis three anim" aria-label="Sending">
        <div className="card kpi"><p className="l">Still to go</p><p className="v">{stats.remaining}</p><p className="s">{c.followsId ? `Goes ${c.delayDays} days after each club gets the email before${stats.ready_now ? `. ${stats.ready_now} ready now` : ""}` : "Clubs this will reach"}</p></div>
        <div className="card kpi"><p className="l">Sent</p><p className="v">{stats.sent}</p><p className="s">{stats.today} today, up to {c.dailyLimit} a day{stats.failed ? ` · ${stats.failed} failed` : ""}</p></div>
        <div className="card kpi">
          <p className="l">Send</p>
          <div style={{ marginTop: 8 }}><Controls id={c.id} status={c.status} canStart={Boolean(c.testSentAt)} readyNow={stats.ready_now} /></div>
        </div>
      </section>

      <div style={{ marginTop: 24 }}>
        <Editor
          key={c.status}
          id={c.id} name={c.name} content={c.content} audienceStyle={c.audienceStyle} audienceSource={c.audienceSource}
          followsId={c.followsId} delayDays={c.delayDays} dailyLimit={c.dailyLimit} status={c.status} others={others}
          sample={sample} adminEmail={admin.email}
        />
      </div>

      {recent.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="ch"><h2>Latest sends</h2><span className="m">Newest first</span></div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead><tr><th scope="col">Club</th><th scope="col">Result</th><th scope="col">When</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={`${r.email}-${r.at.getTime()}`}>
                    <td><b>{r.clubName || r.email}</b><span className="sub">{r.email}</span></td>
                    <td>{r.status === "sent" ? <span className="pill ok">Sent</span> : r.status === "queued" ? <span className="pill neutral">Sending</span> : <span className="pill bad" title={r.error ?? undefined}>Failed</span>}</td>
                    <td>{when(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
