import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireSuperAdmin } from "@/auth/admin";
import { ALL_OFF, FEATURES, type Feature, type FeatureFlags } from "@/lib/feature-list";

/*
 * Feature switches. Read once per request. If the table isn't there (or the database can't be reached) every
 * feature counts as off, so something unfinished is never shown by accident.
 * FEATURES_ON=events,shop (or "all") turns features on without the database, for local work.
 */
export const featureFlags = cache(async (): Promise<FeatureFlags> => {
  const flags = { ...ALL_OFF };
  const env = (process.env.FEATURES_ON ?? "").split(",").map((s) => s.trim());
  for (const f of FEATURES) if (env.includes("all") || env.includes(f.key)) flags[f.key] = true;
  try {
    const rows = (await db().execute(sql`select key, enabled from feature_flags`)) as unknown as Array<{ key: string; enabled: boolean }>;
    for (const r of rows) if (r.key in flags && r.enabled) flags[r.key as Feature] = true;
  } catch {
    // Table not created yet: keep everything off.
  }
  return flags;
});

export async function featureOn(f: Feature) {
  return (await featureFlags())[f];
}

/** For pages and actions of a feature: a 404 while it's switched off. */
export async function requireFeature(f: Feature) {
  if (!(await featureOn(f))) notFound();
}

/** Junbi admin only. */
export async function setFeature(f: Feature, enabled: boolean) {
  const admin = await requireSuperAdmin();
  if (!FEATURES.some((x) => x.key === f)) throw new Error("Unknown feature");
  await db().execute(sql`
    insert into feature_flags (key, enabled, updated_at, updated_by) values (${f}, ${enabled}, now(), ${admin.email})
    on conflict (key) do update set enabled = excluded.enabled, updated_at = now(), updated_by = excluded.updated_by`);
}

/** For the admin page: each switch, whether it's on, and whether switching works yet. */
export async function featureSwitches() {
  await requireSuperAdmin();
  let ready = true;
  const changed: Record<string, { at: Date; by: string | null }> = {};
  try {
    const rows = (await db().execute(sql`select key, updated_at, updated_by from feature_flags`)) as unknown as Array<{ key: string; updated_at: Date; updated_by: string | null }>;
    for (const r of rows) changed[r.key] = { at: new Date(r.updated_at), by: r.updated_by };
  } catch {
    ready = false;
  }
  const flags = await featureFlags();
  return { ready, items: FEATURES.map((f) => ({ ...f, on: flags[f.key], changed: changed[f.key] ?? null })) };
}
