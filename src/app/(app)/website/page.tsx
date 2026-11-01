import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { domainStatus, newSection, websiteEditor, type Section, type SectionType } from "@/data/website";
import { WebsiteEditor } from "./WebsiteEditor";
import { DomainPanel, SettingsPanel } from "./SettingsPanel";

export const metadata: Metadata = { title: "Website" };

export default async function WebsitePage() {
  const actor = await requireActor();
  if (!can(actor, "club.manage")) redirect("/today");
  const w = await websiteEditor(actor);
  const records = w.domain ? (await domainStatus(w.domain).catch(() => null))?.records ?? null : null;
  const starters = Object.fromEntries(w.types.map((t) => [t.type, newSection(t.type, w.clubName)])) as Record<SectionType, Section>;
  const liveUrl = w.domain ? `https://${w.domain}` : `${w.base}/c/${w.slug}`;
  return (
    <>
      <div className="head">
        <div>
          <h1 className="page-title">Website</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>Your club&apos;s website. Add, move and remove sections, add your photos, then publish. Your timetable, prices and sign-up links stay up to date by themselves.</p>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <WebsiteEditor
          initial={w.sections}
          types={w.types}
          newSection={starters}
          previewUrl={`${w.base}/c/${w.slug}?draft=1`}
          liveUrl={liveUrl}
          unpublished={w.unpublishedChanges}
          published={w.published}
        />
      </div>
      <div className="cols" style={{ marginTop: 24, alignItems: "start" }}>
        <section className="card">
          <h2 className="section-title">Settings</h2>
          <div style={{ marginTop: 12 }}>
            <SettingsPanel slug={w.slug} colour={w.colour} phone={w.phone} email={w.email} published={w.published} base={w.base} />
          </div>
        </section>
        <section className="card" id="own-domain">
          <h2 className="section-title">Use your own domain</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Show your website at your own address, like totalcombat.co.uk, instead of {w.base.replace(/^https?:\/\//, "")}/c/{w.slug}.</p>
          <div style={{ marginTop: 12 }}>
            <DomainPanel domain={w.domain} records={records} />
          </div>
        </section>
      </div>
    </>
  );
}
