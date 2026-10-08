import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { getClubOverview } from "@/data/club";
import { DISCIPLINES, type Preset } from "@/lib/disciplines";
import { PLANS, SELF_SERVE_PLANS, formatPounds } from "@/lib/plans";
import { cancelInviteAction, extendTrialAction, removeStaffAction, setArtAction, setPlanAction } from "../actions";
import { AddSiteForm, ClubNameForm, InviteStaffForm } from "./SettingsForms";
import { listPendingInvites } from "@/data/email-flows";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const owner = can(actor, "club.manage");
  if (!owner && !can(actor, "classes.manage")) redirect("/today");
  const [o, invites] = await Promise.all([getClubOverview(actor), listPendingInvites(actor)]);
  const plan = PLANS.find((p) => p.id === o.club.plan);

  return (
    <>
      <h1 className="page-title">Settings</h1>

      {owner && (
        <section className="card" style={{ marginTop: 24 }}>
          <h2 className="section-title">Club</h2>
          <div style={{ marginTop: 16 }}>
            <ClubNameForm name={o.club.name} />
          </div>
        </section>
      )}

      {owner && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title">Plan</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
            You&apos;re on <strong style={{ color: "var(--ink)" }}>{plan?.name ?? o.club.plan}</strong>
            {o.club.founding ? " as a Founding Club" : ""}
            {o.club.trialEndsOn ? `. Your free trial runs until ${new Date(`${o.club.trialEndsOn}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.` : "."}
          </p>
          {o.club.plan !== "association" && (
            <div className="list" style={{ marginTop: 8 }}>
              {SELF_SERVE_PLANS.map((p) => {
                const current = p.id === o.club.plan;
                return (
                  <form key={p.id} action={setPlanAction}>
                    <input type="hidden" name="plan" value={p.id} />
                    <span>
                      <strong>{p.name}</strong>
                      <span className="muted" style={{ fontSize: 13 }}> · {formatPounds(p.monthlyPence)} a month · {p.limits}</span>
                    </span>
                    {current ? (
                      <span className="pill ok">Current plan</span>
                    ) : (
                      <button className="btn secondary">Switch to {p.name}</button>
                    )}
                  </form>
                );
              })}
            </div>
          )}
          {o.club.trialEndsOn && !o.club.trialExtended && (
            <form action={extendTrialAction} className="actions" style={{ marginTop: 16 }}>
              <span className="muted" style={{ fontSize: 14 }}>Still moving your club across?</span>
              <button className="btn secondary">Add 14 days to my trial</button>
            </form>
          )}
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Every plan has every feature. Pick the one that fits your club&apos;s size. <a href="/pricing">See pricing</a></p>
        </section>
      )}

      {owner && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title">Arts you teach</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Your dashboard, belts and classes follow these. Turning one on loads its belts; turning one off hides it but keeps all history.</p>
          <div className="list" style={{ marginTop: 8 }}>
            {DISCIPLINES.map((d) => {
              const on = o.activeArts.includes(d.id);
              return (
                <form key={d.id} action={setArtAction}>
                  <input type="hidden" name="discipline" value={d.id} />
                  <input type="hidden" name="on" value={on ? "0" : "1"} />
                  <span>
                    <strong>{d.name}</strong>
                    <span className="muted" style={{ fontSize: 13 }}> · {d.presets.length ? `${(d.presets[0] as Preset).label}` : "No belts"}</span>
                  </span>
                  <button className={`btn ${on ? "secondary" : "primary"}`} aria-pressed={on}>{on ? "On · turn off" : "Turn on"}</button>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Sites</h2>
        <div className="list" style={{ marginTop: 8 }}>
          {o.sites.map((s) => (
            <div key={s.id}>
              <span><strong>{s.name}</strong>{s.address ? <span className="muted"> · {s.address}</span> : null}</span>
            </div>
          ))}
        </div>
        {actor.sites === "all" && (
          <div style={{ marginTop: 20 }}>
            <AddSiteForm />
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Staff</h2>
        <div className="list" style={{ marginTop: 8 }}>
          {o.staff.map((s) => (
            <div key={s.id}>
              <span><strong>{s.name}</strong> <span className="muted">· {s.email}</span></span>
              <span className="actions">
                <span className="pill neutral">{s.role[0].toUpperCase() + s.role.slice(1)}</span>
                {can(actor, "staff.manage") && s.role !== "owner" && s.user_id !== actor.userId && (s.role !== "admin" || owner) && (
                  <form action={removeStaffAction}>
                    <input type="hidden" name="staffId" value={s.id} />
                    <button className="btn ghost" aria-label={`Remove ${s.name}`}>Remove</button>
                  </form>
                )}
              </span>
            </div>
          ))}
          {invites.map((i) => (
            <div key={i.id}>
              <span><strong>{i.email}</strong> <span className="muted">· invited, waiting to accept</span></span>
              <span className="actions">
                <span className="pill neutral">{i.role[0].toUpperCase() + i.role.slice(1)}</span>
                <form action={cancelInviteAction}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button className="btn ghost" aria-label={`Cancel invitation for ${i.email}`}>Cancel</button>
                </form>
              </span>
            </div>
          ))}
        </div>
        {can(actor, "staff.manage") && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Invite someone</h3>
            <InviteStaffForm sites={o.sites.filter((x) => actor.sites === "all" || actor.sites.includes(x.id)).map((x) => ({ id: x.id, name: x.name }))} canInviteAdmin={owner} />
            {!emailConfigured() && <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Email isn&apos;t switched on yet, so invitations are saved but not sent.</p>}
          </div>
        )}
      </section>
    </>
  );
}
