import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { withClub, type Tx } from "@/db/client";
import * as s from "@/db/schema";
import { assertCan, type Actor } from "@/auth/permissions";
import { DISCIPLINES, disciplineName } from "@/lib/disciplines";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  guessMapping,
  matchBelt,
  parseCsv,
  parseDate,
  parseStatus,
  phoneDigits,
  splitName,
  type GradeRef,
  type ImportField,
  type Mapping,
  type Status,
} from "@/lib/import";
import type { Result } from "./accounts";

export type ImportContact = { firstName: string; lastName: string; email: string | null; phone: string | null; relationship: "parent" | "self" };

export type PreviewRow = {
  line: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  siteId: string;
  siteName: string;
  discipline: string;
  gradeId: string | null;
  gradeName: string | null;
  status: Status;
  medical: string | null;
  contact: ImportContact;
  familyKey: string;
  existingHouseholdId: string | null;
  warnings: string[];
  skip: string | null;
};

export type ImportPreview = {
  headers: string[];
  mapping: Mapping;
  rows: PreviewRow[];
  summary: { total: number; toImport: number; skipped: number; newFamilies: number; existingFamilies: number; withBelt: number; withWarnings: number };
};

export type ImportDefaults = { siteId: string; discipline: string };

const ART_ALIASES: Record<string, string> = {
  tkd: "taekwondo", "tae kwon do": "taekwondo",
  "brazilian jiu jitsu": "bjj", "jiu jitsu": "bjj", "jiujitsu": "bjj", "bjj": "bjj",
  krav: "krav_maga", "krav maga": "krav_maga",
  "thai boxing": "muay_thai", "muay thai": "muay_thai",
  "mixed martial arts": "mma",
  "kick boxing": "kickboxing",
};

function findArt(raw: string, active: string[]): string | null {
  const v = raw.toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (!v) return null;
  const id =
    DISCIPLINES.find((d) => d.id === v.replace(/ /g, "_") || d.name.toLowerCase() === v)?.id ??
    Object.entries(ART_ALIASES).find(([k]) => v === k || v.startsWith(`${k} `))?.[1] ??
    DISCIPLINES.find((d) => v.startsWith(d.name.toLowerCase()))?.id ??
    null;
  return id && active.includes(id) ? id : id ? `inactive:${id}` : null;
}

async function loadContext(tx: Tx, actor: Actor) {
  const sites = (await tx.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name))).filter(
    (x) => actor.sites === "all" || actor.sites.includes(x.id),
  );
  const active = (
    await tx.select({ d: s.clubDisciplines.discipline }).from(s.clubDisciplines).where(eq(s.clubDisciplines.active, true)).orderBy(asc(s.clubDisciplines.createdAt))
  ).map((r) => r.d);
  const grades: GradeRef[] = active.length
    ? await tx
        .select({ id: s.grades.id, name: s.grades.name, discipline: s.grades.discipline, beltColour: s.grades.beltColour })
        .from(s.grades)
        .where(inArray(s.grades.discipline, active))
        .orderBy(asc(s.grades.sortOrder))
    : [];
  const guardians = await tx.select({ householdId: s.guardians.householdId, email: s.guardians.email, phone: s.guardians.phone }).from(s.guardians);
  const students = await tx.select({ firstName: s.students.firstName, lastName: s.students.lastName, dateOfBirth: s.students.dateOfBirth }).from(s.students);
  return { sites, active, grades, guardians, students };
}

export async function importOptions(actor: Actor) {
  assertCan(actor, "students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const c = await loadContext(tx, actor);
    return { sites: c.sites, arts: c.active.map((id) => ({ id, name: disciplineName(id) })) };
  });
}

function cleanMapping(m: Mapping | null | undefined, width: number): Mapping {
  const out: Mapping = {};
  for (const f of IMPORT_FIELDS) {
    const v = m?.[f.id];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < width) out[f.id] = v;
  }
  return out;
}

function buildPreview(csv: string, mappingIn: Mapping | null, defaults: ImportDefaults, ctx: Awaited<ReturnType<typeof loadContext>>): Result<ImportPreview> {
  const table = parseCsv(csv);
  if (table.length < 2) return { ok: false, errors: { file: "That file has no students in it. Check it's a CSV with a header row." } };
  const [headers, ...data] = table;
  if (data.length > MAX_IMPORT_ROWS) return { ok: false, errors: { file: `That's more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.` } };
  const mapping = cleanMapping(mappingIn ?? guessMapping(headers), headers.length);
  if (mapping.fullName === undefined && mapping.firstName === undefined) {
    return { ok: false, errors: { mapping: "Choose which column has the student's name." } };
  }

  const site = ctx.sites.find((x) => x.id === defaults.siteId) ?? ctx.sites[0];
  if (!site) return { ok: false, errors: { form: "Add a site in Settings first." } };
  const defaultArt = ctx.active.includes(defaults.discipline) ? defaults.discipline : ctx.active[0] ?? "taekwondo";

  const lc = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const existingStudents = new Set(ctx.students.map((x) => `${lc(x.firstName)}|${lc(x.lastName)}|${x.dateOfBirth ?? ""}`));
  const byEmail = new Map(ctx.guardians.filter((g) => g.email).map((g) => [lc(g.email), g.householdId]));
  const byPhone = new Map(ctx.guardians.filter((g) => g.phone && phoneDigits(g.phone).length >= 7).map((g) => [phoneDigits(g.phone!), g.householdId]));
  const seen = new Set<string>();

  const rows: PreviewRow[] = data.map((cells, i) => {
    const get = (f: ImportField) => (mapping[f] === undefined ? "" : (cells[mapping[f]!] ?? "").trim());
    const warnings: string[] = [];
    let skip: string | null = null;

    let [firstName, lastName] = [get("firstName"), get("lastName")];
    if (!firstName && get("fullName")) [firstName, lastName] = splitName(get("fullName"));
    else if (firstName && !lastName && mapping.lastName === undefined && firstName.includes(" ")) [firstName, lastName] = splitName(firstName);
    firstName = firstName.slice(0, 80);
    lastName = lastName.slice(0, 80);
    if (!firstName) skip = "No student name";
    else if (!lastName) warnings.push("No last name");

    const dobRaw = get("dateOfBirth");
    const dateOfBirth = parseDate(dobRaw);
    if (dobRaw && !dateOfBirth) warnings.push(`Couldn't read date of birth "${dobRaw}"`);

    let rowSite = site;
    const siteRaw = get("site");
    if (siteRaw) {
      const found = ctx.sites.find((x) => lc(x.name) === lc(siteRaw)) ?? ctx.sites.find((x) => lc(x.name).includes(lc(siteRaw)) || lc(siteRaw).includes(lc(x.name)));
      if (found) rowSite = found;
      else warnings.push(`No site called "${siteRaw}", so it goes in ${site.name}`);
    }

    let discipline = defaultArt;
    const artRaw = get("art");
    if (artRaw) {
      const a = findArt(artRaw, ctx.active);
      if (a && !a.startsWith("inactive:")) discipline = a;
      else if (a) warnings.push(`${disciplineName(a.slice(9))} isn't switched on, so it's ${disciplineName(defaultArt)}`);
      else warnings.push(`Didn't recognise the art "${artRaw}", so it's ${disciplineName(defaultArt)}`);
    }

    const beltRaw = get("belt");
    let gradeId: string | null = null;
    let gradeName: string | null = null;
    if (beltRaw) {
      const m = matchBelt(beltRaw, ctx.grades.filter((g) => g.discipline === discipline));
      if (m.grade) [gradeId, gradeName] = [m.grade.id, m.grade.name];
      if (m.note) warnings.push(m.note);
    }

    const statusRaw = get("status");
    const status = parseStatus(statusRaw) ?? "active";
    if (statusRaw && !parseStatus(statusRaw)) warnings.push(`Didn't recognise status "${statusRaw}", so they're active`);

    let [gFirst, gLast] = [get("guardianFirstName"), get("guardianLastName")];
    if (!gFirst && get("guardianName")) [gFirst, gLast] = splitName(get("guardianName"));
    else if (gFirst && !gLast && gFirst.includes(" ")) [gFirst, gLast] = splitName(gFirst);
    const emailRaw = get("email").toLowerCase();
    const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw.slice(0, 200) : null;
    // Exports often put a phone number in the email column.
    const emailIsPhone = !!emailRaw && !email && phoneDigits(emailRaw).length >= 7 && /^[\d\s()+-]+$/.test(emailRaw);
    if (emailRaw && !email && !emailIsPhone) warnings.push(`"${emailRaw}" isn't a valid email`);
    const phone = (get("phone") || (emailIsPhone ? emailRaw : "")).slice(0, 40) || null;
    const contact: ImportContact = gFirst
      ? { firstName: gFirst.slice(0, 80), lastName: (gLast || lastName).slice(0, 80), email, phone, relationship: "parent" }
      : { firstName, lastName, email, phone, relationship: "self" };

    const digits = phone ? phoneDigits(phone) : "";
    const familyKey = email ? `e:${email}` : digits.length >= 7 ? `p:${digits}` : gFirst ? `n:${lc(gFirst)} ${lc(contact.lastName)}` : `row:${i}`;
    const existingHouseholdId = (email && byEmail.get(email)) || (digits.length >= 7 && byPhone.get(digits)) || null;

    if (!skip) {
      const key = `${lc(firstName)}|${lc(lastName)}|${dateOfBirth ?? ""}`;
      if (existingStudents.has(key)) skip = "Already in Junbi";
      else if (seen.has(key)) skip = "Same student twice in the file";
      seen.add(key);
    }
    if (!email && !phone && !skip) warnings.push("No email or phone for the family");

    return {
      line: i + 2,
      firstName,
      lastName,
      dateOfBirth,
      siteId: rowSite.id,
      siteName: rowSite.name,
      discipline,
      gradeId,
      gradeName,
      status,
      medical: get("medical").slice(0, 2000) || null,
      contact,
      familyKey,
      existingHouseholdId,
      warnings,
      skip,
    };
  });

  const live = rows.filter((r) => !r.skip);
  return {
    ok: true,
    value: {
      headers,
      mapping,
      rows,
      summary: {
        total: rows.length,
        toImport: live.length,
        skipped: rows.length - live.length,
        newFamilies: new Set(live.filter((r) => !r.existingHouseholdId).map((r) => r.familyKey)).size,
        existingFamilies: new Set(live.filter((r) => r.existingHouseholdId).map((r) => r.existingHouseholdId)).size,
        withBelt: live.filter((r) => r.gradeId).length,
        withWarnings: live.filter((r) => r.warnings.length).length,
      },
    },
  };
}

/** Reads the file and shows what would happen, without changing anything. */
export async function previewImport(actor: Actor, csv: string, mapping: Mapping | null, defaults: ImportDefaults): Promise<Result<ImportPreview>> {
  assertCan(actor, "students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => buildPreview(csv, mapping, defaults, await loadContext(tx, actor)));
}

/** Imports every row that isn't skipped, in one go: all or nothing. */
export async function runImport(
  actor: Actor,
  csv: string,
  mapping: Mapping | null,
  defaults: ImportDefaults,
): Promise<Result<{ students: number; families: number; belts: number }>> {
  assertCan(actor, "students.edit");
  return withClub({ clubId: actor.clubId, userId: actor.userId }, async (tx) => {
    const p = buildPreview(csv, mapping, defaults, await loadContext(tx, actor));
    if (!p.ok) return p;
    const live = p.value.rows.filter((r) => !r.skip);
    if (!live.length) return { ok: false as const, errors: { form: "There's nobody new to import." } };

    const households = new Map<string, string>();
    let families = 0;
    for (const r of live) {
      if (r.existingHouseholdId) {
        households.set(r.familyKey, r.existingHouseholdId);
        continue;
      }
      if (households.has(r.familyKey)) continue;
      const surname = r.contact.lastName || r.lastName || r.firstName;
      const [h] = await tx.insert(s.households).values({ clubId: actor.clubId, name: `${surname} family` }).returning({ id: s.households.id });
      await tx.insert(s.guardians).values({
        clubId: actor.clubId,
        householdId: h.id,
        firstName: r.contact.firstName,
        lastName: r.contact.lastName || r.lastName || "",
        email: r.contact.email,
        phone: r.contact.phone,
        relationship: r.contact.relationship,
        isPayer: true,
      });
      households.set(r.familyKey, h.id);
      families++;
    }

    const today = new Date().toISOString().slice(0, 10);
    let belts = 0;
    for (let i = 0; i < live.length; i += 200) {
      const chunk = live.slice(i, i + 200);
      const inserted = await tx
        .insert(s.students)
        .values(
          chunk.map((r) => ({
            clubId: actor.clubId,
            householdId: households.get(r.familyKey)!,
            siteId: r.siteId,
            firstName: r.firstName,
            lastName: r.lastName,
            dateOfBirth: r.dateOfBirth,
            status: r.status,
            medicalNotes: r.medical,
            source: "import",
          })),
        )
        .returning({ id: s.students.id });
      const results = chunk
        .map((r, j) => (r.gradeId ? { clubId: actor.clubId, studentId: inserted[j].id, gradeId: r.gradeId, gradedOn: today, outcome: "pass" as const, examiner: "Imported into Junbi" } : null))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (results.length) await tx.insert(s.gradingResults).values(results);
      belts += results.length;
    }
    await tx.insert(s.auditLog).values({
      clubId: actor.clubId,
      actorUserId: actor.userId,
      action: "create",
      entity: "student_import",
      after: { students: live.length, families, belts, skipped: p.value.summary.skipped },
    });
    return { ok: true as const, value: { students: live.length, families, belts } };
  });
}

