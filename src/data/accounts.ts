import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "@/auth/password";
import { assertCan, type Actor } from "@/auth/permissions";
import { DISCIPLINES, DISCIPLINE_IDS, TAEKWONDO_PRESETS } from "@/lib/disciplines";

export type FieldErrors = Partial<Record<string, string>>;
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const TRIAL_DAYS = 30;

export const signupSchema = z.object({
  clubName: z.string().trim().min(2, "Please enter your club's name.").max(120),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(200),
  password: z.string(),
  plan: z.enum(["essentials", "pro"]).catch("essentials"),
  founding: z.boolean(),
  terms: z.boolean().refine((v) => v, "Please agree to the terms to continue."),
});

export type SignupInput = z.input<typeof signupSchema>;

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "club";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/** Creates the owner's login, their club and their owner role in one transaction. */
export async function createClubAccount(input: SignupInput): Promise<Result<{ userId: string; clubId: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const pw = passwordProblem(d.password, d.email);
  if (pw) return { ok: false, errors: { password: pw } };

  const passwordHash = await hashPassword(d.password);
  const clubId = randomUUID();
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString().slice(0, 10);

  try {
    const userId = await withClub({ clubId }, async (tx) => {
      const rows = (await tx.execute(
        sql`select auth_create_user(${d.email}, ${d.name}, ${passwordHash}) as id`,
      )) as unknown as Array<{ id: string | null }>;
      const id = rows[0]?.id;
      if (!id) throw new EmailTakenError();
      await tx.insert(s.clubs).values({ id: clubId, name: d.clubName, slug: slugify(d.clubName), plan: d.plan, founding: d.founding, trialEndsOn: trialEnds });
      await tx.insert(s.clubStaff).values({ clubId, userId: id, role: "owner", allSites: true });
      return id;
    });
    return { ok: true, value: { userId, clubId } };
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return { ok: false, errors: { email: "There's already an account with this email. Sign in instead." } };
    }
    throw err;
  }
}

class EmailTakenError extends Error {}

const MAX_FAILURES = 8;

/** Checks a password. Returns the user id, or a single vague error so emails can't be probed. */
export async function checkLogin(emailRaw: string, password: string): Promise<Result<{ userId: string }>> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password || email.length > 200 || password.length > 200) {
    return { ok: false, errors: { form: "Enter your email and password." } };
  }
  const [row] = (await db().execute(sql`select * from auth_login_lookup(${email})`)) as unknown as Array<{
    user_id: string | null;
    password_hash: string | null;
    recent_failures: number;
  }>;
  if ((row?.recent_failures ?? 0) >= MAX_FAILURES) {
    return { ok: false, errors: { form: "Too many attempts. Please wait 15 minutes and try again." } };
  }
  const ok = await verifyPassword(password, row?.password_hash);
  if (!ok || !row?.user_id) {
    await db().execute(sql`select auth_record_failure(${email})`);
    return { ok: false, errors: { form: "That email and password don't match." } };
  }
  await db().execute(sql`select auth_clear_failures(${email})`);
  return { ok: true, value: { userId: row.user_id } };
}

/* ---------- Club set-up ---------- */

export const setupSchema = z.object({
  disciplines: z.array(z.enum(DISCIPLINE_IDS)).default([]),
  interest: z.array(z.enum(DISCIPLINE_IDS)).default([]),
  siteName: z.string().trim().min(2, "Give your first site a name, e.g. the town it's in.").max(80),
  siteAddress: z.string().trim().max(200).optional(),
  syllabus: z.enum(["wt", "itf", "none"]).catch("wt"),
});

export type SetupInput = z.input<typeof setupSchema>;

export async function completeSetup(actor: Actor, input: SetupInput): Promise<Result> {
  assertCan(actor, "club.manage");
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const available = new Set<string>(DISCIPLINES.filter((x) => x.available).map((x) => x.id));
  const active = d.disciplines.filter((x) => available.has(x));
  if (!active.length) return { ok: false, errors: { disciplines: "Choose at least one art you teach." } };
  const interest = d.interest.filter((x) => !available.has(x));

  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select({ onboardedAt: s.clubs.onboardedAt }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    if (club?.onboardedAt) return; // already done; ignore a double submit

    await tx
      .insert(s.clubDisciplines)
      .values([
        ...active.map((discipline) => ({ clubId: actor.clubId, discipline, active: true })),
        ...interest.map((discipline) => ({ clubId: actor.clubId, discipline, active: false })),
      ])
      .onConflictDoNothing();

    await tx.insert(s.sites).values({ clubId: actor.clubId, name: d.siteName, address: d.siteAddress || null });

    if (active.includes("taekwondo") && d.syllabus !== "none") {
      const preset = TAEKWONDO_PRESETS[d.syllabus];
      await tx.insert(s.grades).values(
        preset.grades.map((g, i) => ({ clubId: actor.clubId, discipline: "taekwondo", sortOrder: i, ...g })),
      );
    }
    await tx.update(s.clubs).set({ onboardedAt: new Date() }).where(eq(s.clubs.id, actor.clubId));
  });
  return { ok: true, value: undefined };
}
