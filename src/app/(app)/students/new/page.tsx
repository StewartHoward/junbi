import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { studentFormOptions } from "@/data/student-edit";
import { getLead } from "@/data/leads";
import { createStudentAction } from "../actions";
import { StudentForm } from "../StudentForm";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ household?: string; lead?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "students.edit")) {
    return <p className="card">Your role can&apos;t add students. Ask an admin.</p>;
  }
  const { household, lead: leadId } = await searchParams;
  const [opts, lead] = await Promise.all([studentFormOptions(actor, { householdId: household }), leadId ? getLead(actor, leadId) : null]);
  // Coming from a lead: fill in what we already know.
  const initial = lead
    ? (() => {
        const kid = lead.studentName?.trim();
        const [kf, ...kl] = (kid || lead.firstName).split(/\s+/);
        return {
          firstName: kid ? kf : lead.firstName,
          lastName: kid ? kl.join(" ") || lead.lastName : lead.lastName,
          siteId: lead.siteId ?? "",
          guardianFirstName: lead.firstName,
          guardianLastName: lead.lastName,
          guardianEmail: lead.email ?? "",
          guardianPhone: lead.phone ?? "",
          relationship: kid ? "parent" : "self",
        };
      })()
    : undefined;
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/students">Students</Link> › Add student
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>{opts.household ? "Add a sibling" : "Add a student"}</h1>
      {!opts.household && (
        <p className="muted" style={{ marginTop: 8 }}>
          Rather the family filled it in? <Link href="/students#join">Send them your sign-up link</Link>.
        </p>
      )}
      <div className="card" style={{ marginTop: 24 }}>
        {opts.sites.length === 0 ? (
          <p>Add a site in <Link href="/settings">Settings</Link> first.</p>
        ) : (
          <StudentForm mode="new" action={createStudentAction} sites={opts.sites} grades={opts.grades} household={opts.household} initial={initial} cancelHref="/students" />
        )}
      </div>
    </>
  );
}
