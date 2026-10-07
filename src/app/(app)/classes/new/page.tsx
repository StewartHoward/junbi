import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { getClubOverview } from "@/data/club";
import { disciplineName } from "@/lib/disciplines";
import { ClassForm } from "./ClassForm";

export const metadata: Metadata = { title: "Add class" };

export default async function NewClassPage() {
  const actor = await requireActor();
  if (!can(actor, "classes.manage")) return <p className="card">Only owners and admins can change the timetable.</p>;
  const o = await getClubOverview(actor);
  const sites = o.sites.filter((s) => actor.sites === "all" || actor.sites.includes(s.id)).map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/classes">Classes</Link> › Add class
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>Add a weekly class</h1>
      <div className="card" style={{ marginTop: 24 }}>
        <ClassForm sites={sites} arts={o.activeArts.map((id) => ({ id, name: disciplineName(id) }))} />
      </div>
    </>
  );
}
