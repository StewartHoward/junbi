"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth/session";
import type { FieldErrors } from "@/data/accounts";
import { saveWebsite } from "@/data/website";

export type WebsiteState = { errors?: FieldErrors; values?: Record<string, string>; saved?: { slug: string; published: boolean } };

export async function saveWebsiteAction(_prev: WebsiteState, f: FormData): Promise<WebsiteState> {
  const actor = await requireActor();
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") values[k] = v;
  const published = f.get("published") === "on";
  const r = await saveWebsite(actor, {
    slug: values.slug ?? "",
    tagline: values.tagline,
    about: values.about,
    phone: values.phone,
    email: values.email,
    colour: values.colour,
    showPrices: f.get("showPrices") === "on",
    published,
  });
  if (!r.ok) return { errors: r.errors, values };
  revalidatePath("/settings");
  return { saved: { slug: r.value.slug, published } };
}
