"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import type { FieldErrors } from "@/data/accounts";
import { addBooking, cancelEvent, createEvent, inviteToEvent, recordResults, setBookingStatus } from "@/data/events";

export type EventFormState = { errors?: FieldErrors; values?: Record<string, string> };
export type NoteState = { errors?: FieldErrors; done?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createEventAction(_prev: EventFormState, f: FormData): Promise<EventFormState> {
  const actor = await requireActor();
  const input = {
    kind: (str(f, "kind") === "event" ? "event" : "grading") as "grading" | "event",
    title: str(f, "title"),
    discipline: str(f, "discipline"),
    siteId: str(f, "siteId"),
    date: str(f, "date"),
    time: str(f, "time"),
    location: str(f, "location"),
    fee: str(f, "fee"),
    capacity: str(f, "capacity"),
    examiner: str(f, "examiner"),
    notes: str(f, "notes"),
  };
  const r = await createEvent(actor, input);
  if (!r.ok) return { errors: r.errors, values: input };
  revalidatePath("/events");
  redirect(`/events/${r.value.id}`);
}

export async function inviteAction(eventId: string, _prev: NoteState, f: FormData): Promise<NoteState> {
  const actor = await requireActor();
  const r = await inviteToEvent(actor, eventId, f.getAll("studentId").map(String));
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/events/${eventId}`);
  const n = r.value.families;
  return {
    done: `Invitations sent to ${n} ${n === 1 ? "family" : "families"}.${r.value.noEmail.length ? ` No email for ${r.value.noEmail.join(", ")}: add one on their profile, or add them below yourself.` : ""}`,
  };
}

export async function addBookingAction(eventId: string, _prev: NoteState, f: FormData): Promise<NoteState> {
  const actor = await requireActor();
  const r = await addBooking(actor, eventId, str(f, "studentId"), f.get("paid") === "on");
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/events/${eventId}`);
  return { done: "Added." };
}

export async function bookingStatusAction(eventId: string, f: FormData) {
  const actor = await requireActor();
  const status = str(f, "status");
  if (status === "cancelled" || status === "paid" || status === "booked") await setBookingStatus(actor, str(f, "bookingId"), status);
  revalidatePath(`/events/${eventId}`);
}

export async function resultsAction(eventId: string, _prev: NoteState, f: FormData): Promise<NoteState> {
  const actor = await requireActor();
  const results: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("r_") && typeof v === "string") results[k.slice(2)] = v;
  const r = await recordResults(actor, eventId, results);
  if (!r.ok) return { errors: r.errors };
  revalidatePath(`/events/${eventId}`);
  return { done: r.value.saved ? "Results saved. Passes are on each student's profile as their new belt." : "Nothing changed." };
}

export async function cancelEventAction(eventId: string) {
  const actor = await requireActor();
  await cancelEvent(actor, eventId);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}
