"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addProspect, createCampaign, deleteCampaign, duplicateCampaign, importProspects, pauseCampaign, saveCampaign, sendNextBatchNow,
  sendTestEmail, setProspectStatus, startCampaign, type ProspectStatus,
} from "@/data/marketing";

export type MktState = { ok?: string; errors?: Partial<Record<string, string>> };
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function importAction(_prev: MktState, f: FormData): Promise<MktState> {
  const file = f.get("file");
  const fromFile = file instanceof File && file.size > 0 ? (file.size > 5_000_000 ? null : await file.text()) : "";
  if (fromFile === null) return { errors: { csv: "That file is over 5MB. Split it into smaller files." } };
  const r = await importProspects(fromFile || str(f, "csv"), { source: str(f, "source"), style: str(f, "style") });
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/admin/marketing");
  const { added, updated, skipped } = r.value;
  return { ok: `Added ${added}, updated ${updated}${skipped ? `, skipped ${skipped} rows without a valid email` : ""}.` };
}

export async function addProspectAction(_prev: MktState, f: FormData): Promise<MktState> {
  const r = await addProspect({
    email: str(f, "email"), clubName: str(f, "clubName"), contactName: str(f, "contactName"), phone: str(f, "phone"), website: str(f, "website"),
    town: str(f, "town"), region: "", style: str(f, "style") as never, organisation: "", source: str(f, "source") || "manual",
  });
  if (!r.ok) return { errors: r.errors };
  revalidatePath("/admin/marketing");
  return { ok: "Added." };
}

export async function prospectStatusAction(id: string, status: ProspectStatus) {
  await setProspectStatus(id, status);
  revalidatePath("/admin/marketing");
}

export async function newCampaignAction(template: string) {
  const r = await createCampaign(template || undefined);
  if (r.ok) redirect(`/admin/marketing/${r.value.id}`);
}

const campaignFromForm = (f: FormData) => ({
  name: str(f, "name"), subject: str(f, "subject"), preheader: str(f, "preheader"), heading: str(f, "heading"), body: str(f, "body"),
  buttonLabel: str(f, "buttonLabel"), buttonUrl: str(f, "buttonUrl"), audienceStyle: (str(f, "audienceStyle") || "all") as "all",
  audienceSource: str(f, "audienceSource"), followsId: str(f, "followsId"), delayDays: Number(str(f, "delayDays") || 0), dailyLimit: Number(str(f, "dailyLimit") || 100),
});

export async function saveCampaignAction(id: string, _prev: MktState, f: FormData): Promise<MktState> {
  const intent = str(f, "intent");
  const r = await saveCampaign(id, campaignFromForm(f));
  if (!r.ok) return { errors: r.errors };
  if (intent === "test") {
    const t = await sendTestEmail(id, str(f, "testTo"));
    revalidatePath(`/admin/marketing/${id}`);
    return t.ok ? { ok: `Saved, and a test is on its way to ${t.value.to}. Check it on your phone before sending.` } : { errors: t.errors };
  }
  revalidatePath(`/admin/marketing/${id}`);
  return { ok: "Saved." };
}

export async function controlAction(id: string, what: "start" | "pause" | "batch" | "duplicate" | "delete", _prev: MktState): Promise<MktState> {
  if (what === "duplicate") {
    const r = await duplicateCampaign(id);
    if (r.ok) redirect(`/admin/marketing/${r.value.id}`);
    return { errors: r.ok ? {} : r.errors };
  }
  if (what === "delete") {
    const r = await deleteCampaign(id);
    if (r.ok) redirect("/admin/marketing");
    return { errors: r.ok ? {} : r.errors };
  }
  const r = what === "start" ? await startCampaign(id) : what === "pause" ? await pauseCampaign(id) : await sendNextBatchNow(id);
  revalidatePath(`/admin/marketing/${id}`);
  revalidatePath("/admin/marketing");
  if (!r.ok) return { errors: r.errors };
  if (what === "start") return { ok: "Sending. Emails go out a few at a time on weekdays between 9am and 5pm, within your daily limit." };
  if (what === "pause") return { ok: "Paused. Nothing more will go out until you resume." };
  const v = r.value as { sent: number; failed: number };
  return { ok: v.sent || v.failed ? `Sent ${v.sent}${v.failed ? `, ${v.failed} failed` : ""}.` : "Nothing to send right now: today's limit is reached, or follow-ups are still waiting." };
}
