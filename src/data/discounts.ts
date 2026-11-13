import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import type { Result } from "./accounts";
import { cleanCode } from "@/lib/discounts";

/*
 * Discount codes: a club makes codes that take a percentage off membership fees. Families type one in on the
 * sign-up link (or QR code). The percentage comes off each membership they sign up for, for as long as it runs.
 * A code can be open to everyone (SUMMER20), limited to a number of families, or a one-off for one family.
 */

export type DiscountRow = {
  id: string;
  code: string;
  percent: number;
  note: string | null;
  maxUses: number | null;
  uses: number;
  expiresOn: string | null;
  active: boolean;
  createdAt: Date;
  /** Members on an active membership with this code right now. */
  members: number;
  /** Why it can't be used just now, or null when families can use it. */
  blocked: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

function blockedReason(c: { active: boolean; maxUses: number | null; uses: number; expiresOn: string | null }): string | null {
  if (!c.active) return "Switched off";
  if (c.expiresOn && c.expiresOn < today()) return "Expired";
  if (c.maxUses !== null && c.uses >= c.maxUses) return "All used";
  return null;
}

export async function listDiscounts(actor: Actor): Promise<DiscountRow[]> {
  assertCan(actor, "payments.manage");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({
        id: s.discountCodes.id,
        code: s.discountCodes.code,
        percent: s.discountCodes.percent,
        note: s.discountCodes.note,
        maxUses: s.discountCodes.maxUses,
        uses: s.discountCodes.uses,
        expiresOn: s.discountCodes.expiresOn,
        active: s.discountCodes.active,
        createdAt: s.discountCodes.createdAt,
        members: sql<number>`(select count(*)::int from memberships m where m.discount_code_id = discount_codes.id and m.status = 'active')`,
      })
      .from(s.discountCodes)
      .orderBy(desc(s.discountCodes.active), desc(s.discountCodes.createdAt));
    return rows.map((r) => ({ ...r, blocked: blockedReason(r) }));
  });
}

const createSchema = z.object({
  code: z
    .string()
    .transform(cleanCode)
    .refine((v) => /^[A-Z0-9-]{3,30}$/.test(v), "Use 3 to 30 letters or numbers, like SUMMER20."),
  percent: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : v.trim().replace(/%$/, "")))
    .refine((v) => v !== "" && /^\d+$/.test(String(v)), "Enter a whole number, like 20.")
    .transform(Number)
    .refine((v) => v >= 1 && v <= 100, "Use 1% to 100%."),
  note: z.string().trim().max(120),
  maxUses: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000), "Enter a number, or leave it blank for no limit.")
    .transform((v) => (v === "" ? null : Number(v))),
  expiresOn: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today()), "Choose a date from today onwards, or leave it blank.")
    .transform((v) => (v === "" ? null : v)),
});
export type DiscountInput = z.input<typeof createSchema>;

export async function createDiscount(actor: Actor, input: DiscountInput): Promise<Result<{ id: string; code: string }>> {
  assertCan(actor, "payments.manage");
  const p = createSchema.safeParse(input);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = p.data;
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [taken] = await tx.select({ id: s.discountCodes.id }).from(s.discountCodes).where(eq(s.discountCodes.code, d.code));
    if (taken) return { ok: false as const, errors: { code: "You already have a code with that name." } };
    const [row] = await tx
      .insert(s.discountCodes)
      .values({ clubId: actor.clubId, code: d.code, percent: d.percent, note: d.note || null, maxUses: d.maxUses, expiresOn: d.expiresOn })
      .returning({ id: s.discountCodes.id });
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "create", entity: "discount_code", entityId: row.id, after: { code: d.code, percent: d.percent } });
    return { ok: true as const, value: { id: row.id, code: d.code } };
  });
}

export async function setDiscountActive(actor: Actor, id: string, active: boolean): Promise<void> {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(id).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.update(s.discountCodes).set({ active }).where(eq(s.discountCodes.id, id));
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "discount_code", entityId: id, after: { active } });
  });
}

/** Deletes a code. Families already using it keep their discount; it just can't be used again. */
export async function deleteDiscount(actor: Actor, id: string): Promise<void> {
  assertCan(actor, "payments.manage");
  if (!z.string().uuid().safeParse(id).success) return;
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [c] = await tx.delete(s.discountCodes).where(eq(s.discountCodes.id, id)).returning({ code: s.discountCodes.code });
    if (c) await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "delete", entity: "discount_code", entityId: id, before: { code: c.code } });
  });
}

/** Whether the club has any code families could use, so the sign-up form only asks when it's worth asking. */
export async function hasLiveDiscounts(tx: Tx): Promise<boolean> {
  const [r] = (await tx.execute(sql`
    select exists (select 1 from discount_codes where active and (expires_on is null or expires_on >= current_date) and (max_uses is null or uses < max_uses)) as live
  `)) as unknown as Array<{ live: boolean }>;
  return Boolean(r?.live);
}

const NOT_VALID = "That code isn't valid. Check it with the club.";

/** Looks a code up for the sign-up form. Doesn't use it up. */
export async function checkDiscount(tx: Tx, raw: string): Promise<{ ok: true; id: string; code: string; percent: number } | { ok: false; error: string }> {
  const code = cleanCode(raw);
  if (!code) return { ok: false, error: "Enter a code." };
  const [c] = await tx.select().from(s.discountCodes).where(eq(s.discountCodes.code, code));
  if (!c) return { ok: false, error: NOT_VALID };
  const why = blockedReason(c);
  if (why === "Expired") return { ok: false, error: "That code has expired." };
  if (why === "All used") return { ok: false, error: "That code has already been used." };
  if (why) return { ok: false, error: NOT_VALID };
  return { ok: true, id: c.id, code: c.code, percent: c.percent };
}

/** Uses a code up as part of a sign-up. Locks the row so two families can't both take the last use. */
export async function redeemDiscount(tx: Tx, raw: string) {
  const code = cleanCode(raw);
  const [c] = await tx.select().from(s.discountCodes).where(eq(s.discountCodes.code, code)).for("update");
  if (!c) return { ok: false as const, error: NOT_VALID };
  const r = await checkDiscount(tx, code);
  if (!r.ok) return r;
  await tx.update(s.discountCodes).set({ uses: sql`${s.discountCodes.uses} + 1` }).where(and(eq(s.discountCodes.id, c.id)));
  return r;
}
