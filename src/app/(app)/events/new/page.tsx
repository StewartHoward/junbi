import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { getClubOverview } from "@/data/club";
import { disciplineName } from "@/lib/disciplines";
import { todayISO } from "@/data/classes";
import { EventForm } from "./EventForm";

export const metadata: Metadata = { title: "Set up" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "classes.manage")) return <p className="card">Only owners and admins can set up gradings and events.</p>;
  const kind = (await searchParams).kind === "event" ? "event" : "grading";
  const o = await getClubOverview(actor);
  const sites = o.sites.filter((s) => actor.sites === "all" || actor.sites.includes(s.id)).map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/events">Gradings and events</Link> › Set up</p>
      <h1 className="page-title" style={{ marginTop: 12 }}>{kind === "grading" ? "Set up a grading" : "Set up an event"}</h1>
      <div className="card" style={{ marginTop: 24 }}>
        <EventForm kind={kind} sites={sites} arts={o.activeArts.map((id) => ({ id, name: disciplineName(id) }))} allSites={actor.sites === "all"} today={todayISO()} />
      </div>
    </>
  );
}
