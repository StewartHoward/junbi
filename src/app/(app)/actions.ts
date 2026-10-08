"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { archiveClass, createClass, setAttendance, validDate } from "@/data/classes";
import { addSite, renameClub, setArt, setPlan } from "@/data/club";
import type { FieldErrors } from "@/data/accounts";

export type ActionState = { errors?: FieldErrors; values?: Record<string, string>; saved?: boolean };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createClassAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const input = {
    name: str(f, "name"),
    siteId: str(f, "siteId"),
    discipline: str(f, "discipline") || "taekwondo",
    weekday: str(f, "weekday"),
    startsAt: str(f, "startsAt"),
    durationMinutes: str(f, "durationMinutes"),
    capacity: str(f, "capacity"),
  };
  const r = await createClass(actor, input);
  if (!r.ok) return { errors: r.errors, values: input };
  revalidatePath("/classes");
  redirect("/classes");
}

export async function archiveClassAction(f: FormData) {
  const actor = await requireActor();
  await archiveClass(actor, str(f, "classId"));
  revalidatePath("/classes");
  redirect("/classes");
}

export async function toggleAttendanceAction(f: FormData) {
  const actor = await requireActor();
  const classId = str(f, "classId");
  const date = validDate(str(f, "date"));
  await setAttendance(actor, classId, date, str(f, "studentId"), str(f, "present") === "1");
  revalidatePath(`/classes/${classId}/register`);
}

export async function renameClubAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const r = await renameClub(actor, str(f, "name"));
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function addSiteAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor();
  const r = await addSite(actor, str(f, "siteName"), str(f, "siteAddress"));
  if (!r.ok) return { errors: r.errors, values: { siteName: str(f, "siteName"), siteAddress: str(f, "siteAddress") } };
  revalidatePath("/settings");
  return { saved: true };
}

export async function setArtAction(f: FormData) {
  const actor = await requireActor();
  await setArt(actor, str(f, "discipline"), str(f, "on") === "1");
  revalidatePath("/", "layout");
}

export async function setPlanAction(f: FormData) {
  const actor = await requireActor();
  await setPlan(actor, str(f, "plan"));
  revalidatePath("/settings");
}
