"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import { previewAudience, sendMessage, type AudiencePreview } from "@/data/messages";
import type { FieldErrors } from "@/data/accounts";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function audienceFrom(f: FormData) {
  const kind = str(f, "kind");
  if (kind === "site") return { kind, siteId: str(f, "siteId") };
  if (kind === "class") return { kind, classId: str(f, "classId") };
  return { kind: "all" };
}

export async function previewAudienceAction(input: { kind: string; siteId?: string; classId?: string }): Promise<AudiencePreview | null> {
  const actor = await requireActor();
  const audience = input.kind === "site" ? { kind: "site", siteId: input.siteId } : input.kind === "class" ? { kind: "class", classId: input.classId } : { kind: "all" };
  const r = await previewAudience(actor, audience);
  return r.ok ? r.value : null;
}

export type SendState = { errors?: FieldErrors; values?: Record<string, string> };

export async function sendMessageAction(_prev: SendState, f: FormData): Promise<SendState> {
  const actor = await requireActor();
  const values = { kind: str(f, "kind"), siteId: str(f, "siteId"), classId: str(f, "classId"), subject: str(f, "subject"), body: str(f, "body") };
  const r = await sendMessage(actor, { audience: audienceFrom(f), subject: values.subject, body: values.body });
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/messages");
  redirect(`/messages/${r.value.id}?sent=1`);
}
