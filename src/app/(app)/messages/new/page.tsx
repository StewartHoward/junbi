import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { messageOptions } from "@/data/messages";
import { emailConfigured } from "@/lib/email";
import { Compose } from "./Compose";

export const metadata: Metadata = { title: "New message" };

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ class?: string; site?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "messages.send")) redirect("/today");
  const opts = await messageOptions(actor);
  const sp = await searchParams;
  const initial = sp.class && opts.classes.some((c) => c.id === sp.class)
    ? { kind: "class", classId: sp.class }
    : sp.site && opts.sites.some((x) => x.id === sp.site)
      ? { kind: "site", siteId: sp.site }
      : { kind: "all" };
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/messages">Messages</Link> › New message
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>New message</h1>
      {!emailConfigured() && (
        <p className="banner" style={{ marginTop: 16 }}>Email isn&apos;t switched on for this site yet, so messages will be saved but not delivered.</p>
      )}
      <Compose sites={opts.sites} classes={opts.classes} allSites={opts.allSites} initial={initial} />
    </>
  );
}
