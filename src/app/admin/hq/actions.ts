"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteEbook, removeCover, saveEbook } from "@/data/library";

export type EbookFormState = { ok?: string; errors?: Partial<Record<string, string>> };
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const list = (f: FormData, k: string) => str(f, k).split("\n").map((s) => s.trim()).filter(Boolean);

function refresh() {
  revalidatePath("/library");
  revalidatePath("/library/[slug]", "page");
  revalidatePath("/admin/hq", "layout");
  revalidatePath("/admin/crm");
  revalidatePath("/sitemap.xml");
}

export async function saveEbookAction(id: string | null, _prev: EbookFormState, f: FormData): Promise<EbookFormState> {
  const r = await saveEbook(id, {
    slug: str(f, "slug"), title: str(f, "title"), subtitle: str(f, "subtitle"), pitch: str(f, "pitch"), description: str(f, "description"),
    pages: Number(str(f, "pages") || 0), price: str(f, "price").replace(/^£/, ""), worth: str(f, "worth").replace(/^£/, ""),
    coverBg: str(f, "coverBg"), coverFg: str(f, "coverFg"), coverAccent: str(f, "coverAccent"),
    forWho: list(f, "forWho"), contents: list(f, "contents"), tipHeading: str(f, "tipHeading"), tipBody: str(f, "tipBody"),
    status: str(f, "status") as never, sort: Number(str(f, "sort") || 0),
  });
  if (!r.ok) return { errors: r.errors };
  refresh();
  redirect(`/admin/hq/${r.value.id}?${id ? "saved" : "created"}=1`);
}

export async function deleteEbookAction(id: string, _prev: EbookFormState): Promise<EbookFormState> {
  const r = await deleteEbook(id);
  if (!r.ok) return { errors: r.errors };
  refresh();
  redirect("/admin/hq");
}

export async function removeCoverAction(id: string) {
  await removeCover(id);
  refresh();
}
