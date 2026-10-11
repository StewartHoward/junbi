import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { leadOptions } from "@/data/leads";
import { LeadForm } from "./LeadForm";

export const metadata: Metadata = { title: "Add a lead" };

export default async function NewLeadPage() {
  const actor = await requireActor();
  if (!can(actor, "students.edit")) redirect("/leads");
  const opts = await leadOptions(actor);
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}><Link href="/leads">Leads</Link> › Add</p>
      <h1 className="page-title" style={{ marginTop: 8 }}>Add a lead</h1>
      <section className="card" style={{ marginTop: 24, maxWidth: 720 }}>
        <LeadForm opts={opts} />
      </section>
    </>
  );
}
