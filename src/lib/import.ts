/**
 * Student import: turning a spreadsheet (CSV) from another system into Junbi students.
 * Pure functions only, so they are easy to test. The database side is src/data/student-import.ts.
 */

export const IMPORT_FIELDS = [
  { id: "fullName", label: "Student name (full)" },
  { id: "firstName", label: "Student first name" },
  { id: "lastName", label: "Student last name" },
  { id: "dateOfBirth", label: "Date of birth" },
  { id: "belt", label: "Belt or grade" },
  { id: "art", label: "Martial art" },
  { id: "site", label: "Site or location" },
  { id: "status", label: "Status" },
  { id: "guardianName", label: "Parent or contact name (full)" },
  { id: "guardianFirstName", label: "Parent first name" },
  { id: "guardianLastName", label: "Parent last name" },
  { id: "email", label: "Contact email" },
  { id: "phone", label: "Contact phone" },
  { id: "address", label: "Address" },
  { id: "town", label: "Town" },
  { id: "postcode", label: "Postcode" },
  { id: "emergencyName", label: "Emergency contact name" },
  { id: "emergencyPhone", label: "Emergency contact phone" },
  { id: "medical", label: "Medical notes" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["id"];
/** Which column (by index) feeds each Junbi field. -1 or missing means not used. */
export type Mapping = Partial<Record<ImportField, number>>;

export const MAX_IMPORT_ROWS = 2000;

/* ---------- CSV ---------- */

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. Also copes with ; or tab files. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = count("\t") > count(",") && count("\t") >= count(";") ? "\t" : count(";") > count(",") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some((v) => v !== ""));
}

/* ---------- Column guessing ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function guessField(header: string): ImportField | null {
  const h = norm(header);
  if (!h) return null;
  const has = (...words: string[]) => words.some((w) => new RegExp(`(^| )${w}`).test(h));
  if (has("emergency", "next of kin", "nok")) return has("phone", "mobile", "tel", "number") ? "emergencyPhone" : "emergencyName";
  if (has("post code", "postcode", "zip")) return "postcode";
  if (has("town", "city")) return "town";
  if (has("address", "street", "house")) return "address";
  if (has("e mail", "email")) return "email";
  if (has("phone", "mobile", "tel", "telephone", "contact number", "cell")) return "phone";
  if (has("dob", "d o b", "birth", "birthday")) return "dateOfBirth";
  if (has("medical", "allerg", "health", "condition")) return "medical";
  if (has("parent", "guardian", "mum", "dad", "carer", "contact", "payer", "account holder")) {
    if (has("first", "forename", "given")) return "guardianFirstName";
    if (has("last", "surname", "family name")) return "guardianLastName";
    return "guardianName";
  }
  if (has("first", "forename", "given")) return "firstName";
  if (has("last", "surname", "family name")) return "lastName";
  if (has("belt", "grade", "rank", "kup", "gup", "kyu", "level")) return "belt";
  if (has("site", "location", "venue", "branch", "dojo", "dojang", "academy", "club")) return "site";
  if (has("art", "discipline", "style", "martial", "programme", "program", "class type")) return "art";
  if (has("status", "membership", "active")) return "status";
  if (has("name", "student", "member")) return "fullName";
  return null;
}

/** First matching column wins for each field. */
export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  headers.forEach((h, i) => {
    const f = guessField(h);
    if (f && m[f] === undefined) m[f] = i;
  });
  // A full name column is only needed when there are no separate first and last names.
  if (m.firstName !== undefined && m.lastName !== undefined) delete m.fullName;
  if (m.guardianFirstName !== undefined) delete m.guardianName;
  return m;
}

/* ---------- Values ---------- */

/** "Sam Taylor" → ["Sam", "Taylor"]; "Taylor, Sam" → ["Sam", "Taylor"]. */
export function splitName(full: string): [string, string] {
  const t = full.trim().replace(/\s+/g, " ");
  if (t.includes(",")) {
    const [last, first] = t.split(",", 2).map((x) => x.trim());
    return [first || "", last || ""];
  }
  const parts = t.split(" ");
  if (parts.length === 1) return [parts[0], ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

/** UK-first date reading: 31/01/2015, 31-01-15, 2015-01-31, 31.1.2015, or an Excel day number. */
export function parseDate(raw: string, today = new Date()): string | null {
  const v = raw.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    [d, m, y] = [+r[1], +r[2], +r[3]];
    if (r[3].length === 2) {
      const yy = today.getFullYear() % 100;
      y += y <= yy ? 2000 : 1900;
    }
  } else if (/^\d{5}$/.test(v)) {
    const n = +v;
    if (n < 10000 || n > 60000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
    return dt.toISOString().slice(0, 10);
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt > today) return null;
  return dt.toISOString().slice(0, 10);
}

export type Status = "trial" | "active" | "paused" | "frozen" | "cancelled";

export function parseStatus(raw: string): Status | null {
  const v = norm(raw);
  if (!v) return null;
  if (/^(active|live|current|member|paying|yes|y|true|enrolled)/.test(v)) return "active";
  if (/trial|taster|prospect/.test(v)) return "trial";
  if (/pause|hold|suspend/.test(v)) return "paused";
  if (/froz|freeze|injur/.test(v)) return "frozen";
  if (/cancel|left|leaver|inactive|ended|expired|former|lapsed|archiv/.test(v) || /^(no|n|false)$/.test(v)) return "cancelled";
  return null;
}

export const phoneDigits = (p: string) => p.replace(/\D/g, "").replace(/^44/, "0");

/* ---------- Belts ---------- */

const WORD_NUMBERS: Record<string, string> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};
const COLOURS = ["white", "grey", "gray", "yellow", "orange", "green", "blue", "purple", "brown", "red", "black"];

/** "1st Keup (Red Belt)" → "1 kup red"; "Yellow belt" → "yellow". */
export function normaliseBelt(raw: string): string {
  return norm(raw)
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (w) => WORD_NUMBERS[w])
    .replace(/\b(keup|gup|geup|kup)\b/g, "kup")
    .replace(/\bgray\b/g, "grey")
    .replace(/\b(belt|grade|level|degree)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const tokenOf = (n: string) => n.match(/\b(\d+) ?(kup|kyu|dan|poom)\b/)?.slice(1, 3).join(" ") ?? null;

export type GradeRef = { id: string; name: string; discipline: string; beltColour: string };
export type BeltMatch = { grade: GradeRef | null; note?: string };

/** Finds the club's grade for a spreadsheet belt, within one art. Never guesses silently. */
export function matchBelt(raw: string, grades: GradeRef[]): BeltMatch {
  const n = normaliseBelt(raw);
  if (!n) return { grade: null };
  const byName = grades.find((g) => normaliseBelt(g.name) === n);
  if (byName) return { grade: byName };
  const tok = tokenOf(n);
  if (tok) {
    const t = grades.find((g) => tokenOf(normaliseBelt(g.name)) === tok);
    if (t) return { grade: t };
    return { grade: null, note: `No belt called "${raw}" in this art` };
  }
  const words = n.split(" ");
  const colour = COLOURS.find((c) => words.includes(c === "gray" ? "grey" : c));
  if (colour) {
    const same = grades.filter((g) => g.beltColour === colour || normaliseBelt(g.name).split(" ").includes(colour));
    if (same.length === 1) return { grade: same[0] };
    if (same.length > 1) return { grade: same[0], note: `"${raw}" could be more than one belt, so we picked ${same[0].name}` };
  }
  const loose = grades.find((g) => normaliseBelt(g.name).startsWith(n) || n.startsWith(normaliseBelt(g.name)));
  if (loose) return { grade: loose };
  return { grade: null, note: `No belt called "${raw}" in this art` };
}
