import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { studentFormOptions } from "@/data/student-edit";
import { createStudentAction } from "../actions";
import { StudentForm } from "../StudentForm";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ household?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "students.edit")) {
    return <p className="card">Your role can&apos;t add students. Ask an admin.</p>;
  }
  const { household } = await searchParams;
  const opts = await studentFormOptions(actor, { householdId: household });
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/students">Students</Link> › Add student
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>{opts.household ? "Add a sibling" : "Add a student"}</h1>
      <div className="card" style={{ marginTop: 24 }}>
        {opts.sites.length === 0 ? (
          <p>Add a site in <Link href="/settings">Settings</Link> first.</p>
        ) : (
          <StudentForm mode="new" action={createStudentAction} sites={opts.sites} grades={opts.grades} household={opts.household} cancelHref="/students" />
        )}
      </div>
    </>
  );
}
