import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { studentFormOptions } from "@/data/student-edit";
import { updateStudentAction } from "../../actions";
import { StudentForm } from "../../StudentForm";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!can(actor, "students.edit")) notFound();
  const opts = await studentFormOptions(actor, { studentId: id });
  const st = opts.student;
  if (!st) notFound();
  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/students">Students</Link> › <Link href={`/students/${st.id}`}>{st.firstName} {st.lastName}</Link> › Edit
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>Edit {st.firstName}</h1>
      <div className="card" style={{ marginTop: 24 }}>
        <StudentForm
          mode="edit"
          action={updateStudentAction.bind(null, st.id)}
          sites={opts.sites}
          grades={opts.grades}
          cancelHref={`/students/${st.id}`}
          initial={{
            firstName: st.firstName,
            lastName: st.lastName,
            dateOfBirth: st.dateOfBirth,
            siteId: st.siteId,
            status: st.status,
            medicalNotes: can(actor, "medical.view") ? st.medicalNotes : "",
            firstAidConsent: st.firstAidConsent,
            photoConsent: st.photoConsent,
            licenceNumber: st.licenceNumber,
            licenceExpiresOn: st.licenceExpiresOn,
          }}
        />
      </div>
    </>
  );
}
