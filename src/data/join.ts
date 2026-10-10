import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, withClub } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, can, type Actor } from "@/auth/permissions";
import { disciplineName } from "@/lib/disciplines";
import { appUrl, sendEmail, templates } from "@/lib/email";
import type { FieldErrors, Result } from "./accounts";

/*
 * Family sign-up link: each club has one secret link (/join/<token>) that staff share or email.
 * Parents fill in their details and their children's, and the students land in the club as Trial.
 */

export async function joinLink(actor: Actor): Promise<string> {
  assertCan(actor, "students.edit");
  const [c] = await withClub({ clubId: actor.clubId, userId: actor.userId }, (tx) =>
    tx.select({ token: s.clubs.joinToken }).from(s.clubs).where(eq(s.clubs.id, actor.clubId)),
  );
  return `${await appUrl()}/join/${c.token}`;
}

/** Makes a new link; the old one stops working. For when a link has been shared too widely. */
export async function resetJoinLink(actor: Actor): Promise<void> {
  assertCan(actor, "club.manage");
  await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    await tx.execute(sql`update clubs set join_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where id = ${actor.clubId}::uuid`);
    await tx.insert(s.auditLog).values({ clubId: actor.clubId, actorUserId: actor.userId, action: "update", entity: "club_join_link", entityId: actor.clubId });
  });
}

export async function sendJoinLink(actor: Actor, emailRaw: string): Promise<Result<{ email: string }>> {
  assertCan(actor, "students.edit");
  const e = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200).safeParse(emailRaw);
  if (!e.success) return { ok: false, errors: { email: e.error.issues[0].message } };
  const url = await joinLink(actor);
  const { clubName, inviter } = await withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const [club] = await tx.select({ name: s.clubs.name }).from(s.clubs).where(eq(s.clubs.id, actor.clubId));
    const [me] = (await tx.execute(sql`select name from users where id = ${actor.userId}::uuid`)) as unknown as Array<{ name: string }>;
    return { clubName: club.name, inviter: me?.name ?? null };
  });
  const t = templates.joinInvite(clubName, inviter, url);
  await sendEmail({ to: e.data, ...t, template: "join-invite", clubId: actor.clubId });
  return { ok: true, value: { email: e.data } };
}

const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32,100}$/.test(t);

async function lookup(token: unknown): Promise<{ clubId: string; clubName: string } | null> {
  if (!tokenOk(token)) return null;
  const [r] = (await db().execute(sql`select * from join_club_lookup(${token})`)) as unknown as Array<{ club_id: string; club_name: string }>;
  return r ? { clubId: r.club_id, clubName: r.club_name } : null;
}

export type JoinForm = { clubName: string; sites: Array<{ id: string; name: string }>; arts: Array<{ id: string; name: string }> };

/** What the public sign-up page needs. Null when the link is wrong or has been reset. */
export async function joinForm(token: unknown): Promise<JoinForm | null> {
  const club = await lookup(token);
  if (!club) return null;
  return withClub({ clubId: club.clubId }, async (tx) => {
    const sites = await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name));
    const arts = (
      await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)).orderBy(asc(s.clubDisciplines.createdAt))
    ).map((r) => ({ id: r.d, name: disciplineName(r.d) }));
    return { clubName: club.clubName, sites, arts };
  });
}

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const dob = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && v <= new Date().toISOString().slice(0, 10) && v >= "1920-01-01", "Enter their date of birth.");

export const MAX_CHILDREN = 6;

export const joinSchema = z
  .object({
    who: z.enum(["children", "me"]),
    parentFirstName: text(1, 80, "Enter your first name."),
    parentLastName: text(1, 80, "Enter your last name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    phone: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a phone number we can reach you on."),
    myDateOfBirth: z.string().optional(),
    mySiteId: z.string().optional(),
    myMedical: z.string().trim().max(2000).optional(),
    children: z
      .array(
        z.object({
          firstName: text(1, 80, "Enter their first name."),
          lastName: z.string().trim().max(80).optional(),
          dateOfBirth: dob,
          siteId: z.string(),
          medical: z.string().trim().max(2000).optional(),
        }),
      )
      .max(MAX_CHILDREN),
    firstAidConsent: z.boolean(),
    photoConsent: z.boolean(),
    terms: z.boolean().refine((v) => v, "Please tick to confirm."),
  })
  .superRefine((d, ctx) => {
    if (d.who === "children" && d.children.length === 0) ctx.addIssue({ code: "custom", path: ["children"], message: "Add at least one child." });
    if (d.who === "me" && !dob.safeParse(d.myDateOfBirth ?? "").success) ctx.addIssue({ code: "custom", path: ["myDateOfBirth"], message: "Enter your date of birth." });
  });

export type JoinInput = z.input<typeof joinSchema>;

function joinErrors(e: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of e.issues) {
    const key = i.path[0] === "children" && typeof i.path[1] === "number" ? `children.${i.path[1]}.${String(i.path[2] ?? "")}` : String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

/** Saves a family sign-up. Students start as Trial so the club can see who's new. */
export async function submitJoin(token: unknown, input: JoinInput): Promise<Result<{ clubName: string; names: string[] }>> {
  const club = await lookup(token);
  if (!club) return { ok: false, errors: { form: "This sign-up link has changed. Ask the club for the new one." } };
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: joinErrors(parsed.error) };
  const d = parsed.data;

  const out = await withClub({ clubId: club.clubId }, async (tx) => {
    const sites = new Set((await tx.select({ id: s.sites.id }).from(s.sites)).map((x) => x.id));
    const firstSite = [...sites][0];
    if (!firstSite) return { error: { form: "This club isn't taking sign-ups yet." } as FieldErrors };

    const people =
      d.who === "me"
        ? [{ firstName: d.parentFirstName, lastName: d.parentLastName, dateOfBirth: d.myDateOfBirth!, siteId: d.mySiteId ?? "", medical: d.myMedical }]
        : d.children.map((c) => ({ ...c, lastName: c.lastName || d.parentLastName }));

    // Join an existing family when the club already has this parent's email.
    const [existing] = (await tx.execute(
      sql`select household_id from guardians where lower(email) = ${d.email} order by created_at limit 1`,
    )) as unknown as Array<{ household_id: string }>;
    let householdId = existing?.household_id;
    if (!householdId) {
      const [h] = await tx.insert(s.households).values({ clubId: club.clubId, name: `${d.parentLastName} family` }).returning({ id: s.households.id });
      householdId = h.id;
      await tx.insert(s.guardians).values({
        clubId: club.clubId,
        householdId,
        firstName: d.parentFirstName,
        lastName: d.parentLastName,
        email: d.email,
        phone: d.phone,
        relationship: d.who === "me" ? "self" : "parent",
        isPayer: true,
      });
    }

    const already = await tx
      .select({ firstName: s.students.firstName, lastName: s.students.lastName, dateOfBirth: s.students.dateOfBirth })
      .from(s.students)
      .where(eq(s.students.householdId, householdId));
    const key = (p: { firstName: string; lastName: string; dateOfBirth: string | null }) => `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}|${p.dateOfBirth ?? ""}`;
    const have = new Set(already.map(key));

    const names: string[] = [];
    for (const p of people) {
      if (have.has(key(p))) {
        names.push(p.firstName);
        continue;
      }
      have.add(key(p));
      const [st] = await tx
        .insert(s.students)
        .values({
          clubId: club.clubId,
          householdId,
          siteId: sites.has(p.siteId) ? p.siteId : firstSite,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          status: "trial",
          medicalNotes: p.medical || null,
          firstAidConsent: d.firstAidConsent,
          photoConsent: d.photoConsent,
          source: "join_link",
        })
        .returning({ id: s.students.id });
      await tx.insert(s.auditLog).values({ clubId: club.clubId, action: "create", entity: "student", entityId: st.id, after: { via: "join_link" } });
      names.push(p.firstName);
    }

    const notify = (await tx.execute(
      sql`select u.email from club_staff cs join users u on u.id = cs.user_id where cs.role in ('owner', 'admin')`,
    )) as unknown as Array<{ email: string }>;
    return { names, notify: notify.map((n) => n.email) };
  });
  if ("error" in out) return { ok: false, errors: out.error! };

  const url = await appUrl();
  const parentName = `${d.parentFirstName} ${d.parentLastName}`;
  const confirm = templates.joinConfirm(parentName, club.clubName, out.names);
  const alert = templates.newSignup(club.clubName, parentName, out.names, `${url}/students`);
  // Never let email trouble undo a sign-up.
  await Promise.allSettled([
    sendEmail({ to: d.email, ...confirm, template: "join-confirm", clubId: club.clubId }),
    ...out.notify.map((to) => sendEmail({ to, ...alert, template: "new-signup", clubId: club.clubId })),
  ]);
  return { ok: true, value: { clubName: club.clubName, names: out.names } };
}

/** Students who signed up through the link in the last 14 days, newest first, for the Today page. */
export async function recentSignups(actor: Actor) {
  if (!can(actor, "students.view")) return [];
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const rows = await tx
      .select({ id: s.students.id, firstName: s.students.firstName, lastName: s.students.lastName, siteId: s.students.siteId, site: s.sites.name, createdAt: s.students.createdAt })
      .from(s.students)
      .innerJoin(s.sites, eq(s.sites.id, s.students.siteId))
      .where(and(eq(s.students.source, "join_link"), gt(s.students.createdAt, new Date(Date.now() - 14 * 86_400_000))))
      .orderBy(desc(s.students.createdAt))
      .limit(20);
    return rows.filter((r) => actor.sites === "all" || actor.sites.includes(r.siteId)).slice(0, 8);
  });
}
