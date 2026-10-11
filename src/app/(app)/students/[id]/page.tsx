import { redirect } from "next/navigation";

/** Profiles open on the right of the Students list, so old links land there. */
export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/students?id=${id}` : "/students");
}
