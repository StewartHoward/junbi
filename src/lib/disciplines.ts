/**
 * Martial arts Junbi supports. Each art carries the belt systems a club can start from
 * ("presets"). Clubs can rename or add grades later, so presets are a starting point, not a rule.
 */

export type BeltColour = "white" | "grey" | "yellow" | "orange" | "green" | "blue" | "purple" | "brown" | "red" | "black" | "none";
export type GradeKind = "kup" | "poom" | "dan" | "kyu" | "grade";
export type BeltPreset = { name: string; kind: GradeKind; beltColour: BeltColour; classesRequired: number };
export type Preset = { id: string; label: string; description: string; grades: BeltPreset[] };

const g = (name: string, kind: GradeKind, beltColour: BeltColour, classesRequired: number): BeltPreset => ({ name, kind, beltColour, classesRequired });
const dans = (n: number, word = "Dan", kind: GradeKind = "dan") =>
  Array.from({ length: n }, (_, i) => g(`${ordinal(i + 1)} ${word}`, kind, "black", [100, 150, 200, 250, 300][i] ?? 300));
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const DISCIPLINES = [
  {
    id: "taekwondo",
    name: "Taekwondo",
    place: "dojang",
    presets: [
      {
        id: "wt",
        label: "WT / Kukkiwon",
        description: "10th Kup to 1st Kup, then Poom and Dan.",
        grades: [
          g("10th Kup", "kup", "white", 16), g("9th Kup", "kup", "yellow", 16), g("8th Kup", "kup", "yellow", 20),
          g("7th Kup", "kup", "green", 20), g("6th Kup", "kup", "green", 24), g("5th Kup", "kup", "blue", 24),
          g("4th Kup", "kup", "blue", 28), g("3rd Kup", "kup", "red", 28), g("2nd Kup", "kup", "red", 32),
          g("1st Kup", "kup", "red", 40), g("1st Poom", "poom", "red", 60), ...dans(3),
        ],
      },
      {
        id: "itf",
        label: "ITF",
        description: "10th Gup to 1st Gup, then Dan.",
        grades: [
          g("10th Gup", "kup", "white", 16), g("9th Gup", "kup", "yellow", 16), g("8th Gup", "kup", "yellow", 20),
          g("7th Gup", "kup", "green", 20), g("6th Gup", "kup", "green", 24), g("5th Gup", "kup", "blue", 24),
          g("4th Gup", "kup", "blue", 28), g("3rd Gup", "kup", "red", 28), g("2nd Gup", "kup", "red", 32),
          g("1st Gup", "kup", "red", 40), ...dans(3),
        ],
      },
    ],
  },
  {
    id: "karate",
    name: "Karate",
    place: "dojo",
    presets: [
      {
        id: "kyu",
        label: "Kyu and dan",
        description: "9th Kyu orange to 1st Kyu brown, then Dan.",
        grades: [
          g("9th Kyu", "kyu", "orange", 16), g("8th Kyu", "kyu", "red", 20), g("7th Kyu", "kyu", "yellow", 20),
          g("6th Kyu", "kyu", "green", 24), g("5th Kyu", "kyu", "purple", 24), g("4th Kyu", "kyu", "purple", 28),
          g("3rd Kyu", "kyu", "brown", 32), g("2nd Kyu", "kyu", "brown", 36), g("1st Kyu", "kyu", "brown", 40), ...dans(3),
        ],
      },
    ],
  },
  {
    id: "kickboxing",
    name: "Kickboxing",
    place: "gym",
    presets: [
      {
        id: "colours",
        label: "Coloured belts",
        description: "White to brown, then black belt Dan grades.",
        grades: [
          g("White belt", "grade", "white", 12), g("Yellow belt", "grade", "yellow", 16), g("Orange belt", "grade", "orange", 20),
          g("Green belt", "grade", "green", 24), g("Blue belt", "grade", "blue", 28), g("Purple belt", "grade", "purple", 32),
          g("Brown belt", "grade", "brown", 40), ...dans(3),
        ],
      },
    ],
  },
  {
    id: "judo",
    name: "Judo",
    place: "dojo",
    presets: [
      {
        id: "senior_kyu",
        label: "Senior kyu grades",
        description: "6th Kyu red to 1st Kyu brown, then Dan. Add junior mon grades yourself.",
        grades: [
          g("6th Kyu", "kyu", "red", 20), g("5th Kyu", "kyu", "yellow", 24), g("4th Kyu", "kyu", "orange", 28),
          g("3rd Kyu", "kyu", "green", 32), g("2nd Kyu", "kyu", "blue", 36), g("1st Kyu", "kyu", "brown", 40), ...dans(3),
        ],
      },
    ],
  },
  {
    id: "bjj",
    name: "Brazilian Jiu-Jitsu",
    place: "academy",
    presets: [
      {
        id: "adult",
        label: "Adult belts",
        description: "White, blue, purple, brown, black.",
        grades: [g("White belt", "grade", "white", 0), g("Blue belt", "grade", "blue", 150), g("Purple belt", "grade", "purple", 200), g("Brown belt", "grade", "brown", 200), g("Black belt", "dan", "black", 250)],
      },
      {
        id: "kids",
        label: "Kids belts",
        description: "White, grey, yellow, orange, green.",
        grades: [g("White belt", "grade", "white", 0), g("Grey belt", "grade", "grey", 40), g("Yellow belt", "grade", "yellow", 50), g("Orange belt", "grade", "orange", 60), g("Green belt", "grade", "green", 70)],
      },
    ],
  },
  {
    id: "krav_maga",
    name: "Krav Maga",
    place: "gym",
    presets: [
      {
        id: "levels",
        label: "Practitioner, Graduate, Expert",
        description: "P1 to P5, G1 to G5, then E1 to E3.",
        grades: [
          ...[1, 2, 3, 4, 5].map((n) => g(`P${n}`, "grade", "none", 24)),
          ...[1, 2, 3, 4, 5].map((n) => g(`G${n}`, "grade", "none", 36)),
          ...[1, 2, 3].map((n) => g(`E${n}`, "grade", "black", 100)),
        ],
      },
      {
        id: "colours",
        label: "Coloured belts",
        description: "Yellow to brown, then black.",
        grades: [g("Yellow belt", "grade", "yellow", 24), g("Orange belt", "grade", "orange", 28), g("Green belt", "grade", "green", 32), g("Blue belt", "grade", "blue", 36), g("Brown belt", "grade", "brown", 40), g("Black belt", "dan", "black", 100)],
      },
    ],
  },
  {
    id: "muay_thai",
    name: "Muay Thai",
    place: "gym",
    presets: [
      {
        id: "khan",
        label: "Khan grades",
        description: "Khan 1 to Khan 10.",
        grades: Array.from({ length: 10 }, (_, i) => g(`Khan ${i + 1}`, "grade", "none", 20 + i * 4)),
      },
    ],
  },
  {
    id: "mma",
    name: "MMA",
    place: "gym",
    presets: [],
  },
] as const satisfies ReadonlyArray<{ id: string; name: string; place: string; presets: readonly Preset[] }>;

export type DisciplineId = (typeof DISCIPLINES)[number]["id"];
export const DISCIPLINE_IDS = DISCIPLINES.map((d) => d.id) as [DisciplineId, ...DisciplineId[]];
export const disciplineName = (id: string) => DISCIPLINES.find((d) => d.id === id)?.name ?? id;
export const findDiscipline = (id: string) => DISCIPLINES.find((d) => d.id === id);

/** The belt system a club gets for an art when it doesn't choose one. Null means no belts (attendance only). */
export function defaultPreset(id: string): Preset | null {
  const d = findDiscipline(id);
  return (d?.presets[0] as Preset | undefined) ?? null;
}

export function findPreset(disciplineId: string, presetId: string | undefined): Preset | null {
  if (presetId === "none") return null;
  const d = findDiscipline(disciplineId);
  return ((d?.presets as readonly Preset[] | undefined)?.find((p) => p.id === presetId) ?? defaultPreset(disciplineId)) || null;
}
