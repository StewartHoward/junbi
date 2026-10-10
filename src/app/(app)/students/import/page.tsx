import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { importOptions } from "@/data/student-import";
import { ImportFlow } from "./ImportFlow";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportPage() {
  const actor = await requireActor();
  if (!can(actor, "students.edit")) {
    return <p className="card">Your role can&apos;t add students. Ask an admin.</p>;
  }
  const opts = await importOptions(actor);
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/students">Students</Link> › Import
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>Import students</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
        Bring your students, families and belts across from a spreadsheet or your current system&apos;s export. Nothing is saved until you check it and press Import.
      </p>
      {opts.sites.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p>Add a site in <Link href="/settings">Settings</Link> first.</p>
        </div>
      ) : (
        <ImportFlow sites={opts.sites} arts={opts.arts} />
      )}
    </>
  );
}
