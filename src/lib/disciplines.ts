/**
 * Martial arts Junbi supports, as "discipline packs". Only available packs can be switched on;
 * the rest show as "Coming soon" and a club can ask to be told when they're ready.
 */
export const DISCIPLINES = [
  { id: "taekwondo", name: "Taekwondo", available: true, place: "dojang" },
  { id: "kickboxing", name: "Kickboxing", available: false, place: "gym" },
  { id: "karate", name: "Karate", available: false, place: "dojo" },
  { id: "judo", name: "Judo", available: false, place: "dojo" },
  { id: "krav_maga", name: "Krav Maga", available: false, place: "gym" },
] as const;

export type DisciplineId = (typeof DISCIPLINES)[number]["id"];
export const DISCIPLINE_IDS = DISCIPLINES.map((d) => d.id) as [DisciplineId, ...DisciplineId[]];
export const disciplineName = (id: string) => DISCIPLINES.find((d) => d.id === id)?.name ?? id;

export type BeltPreset = { name: string; kind: "kup" | "poom" | "dan"; beltColour: string; classesRequired: number };

/** Taekwondo belt ladders a club can start from. They can rename or add grades later. */
export const TAEKWONDO_PRESETS: Record<string, { label: string; description: string; grades: BeltPreset[] }> = {
  wt: {
    label: "WT / Kukkiwon",
    description: "10th Kup to 1st Kup, then Poom and Dan.",
    grades: [
      { name: "10th Kup", kind: "kup", beltColour: "white", classesRequired: 16 },
      { name: "9th Kup", kind: "kup", beltColour: "yellow", classesRequired: 16 },
      { name: "8th Kup", kind: "kup", beltColour: "yellow", classesRequired: 20 },
      { name: "7th Kup", kind: "kup", beltColour: "green", classesRequired: 20 },
      { name: "6th Kup", kind: "kup", beltColour: "green", classesRequired: 24 },
      { name: "5th Kup", kind: "kup", beltColour: "blue", classesRequired: 24 },
      { name: "4th Kup", kind: "kup", beltColour: "blue", classesRequired: 28 },
      { name: "3rd Kup", kind: "kup", beltColour: "red", classesRequired: 28 },
      { name: "2nd Kup", kind: "kup", beltColour: "red", classesRequired: 32 },
      { name: "1st Kup", kind: "kup", beltColour: "red", classesRequired: 40 },
      { name: "1st Poom", kind: "poom", beltColour: "red", classesRequired: 60 },
      { name: "1st Dan", kind: "dan", beltColour: "black", classesRequired: 100 },
      { name: "2nd Dan", kind: "dan", beltColour: "black", classesRequired: 150 },
      { name: "3rd Dan", kind: "dan", beltColour: "black", classesRequired: 200 },
    ],
  },
  itf: {
    label: "ITF",
    description: "10th Gup to 1st Gup, then Dan.",
    grades: [
      { name: "10th Gup", kind: "kup", beltColour: "white", classesRequired: 16 },
      { name: "9th Gup", kind: "kup", beltColour: "yellow", classesRequired: 16 },
      { name: "8th Gup", kind: "kup", beltColour: "yellow", classesRequired: 20 },
      { name: "7th Gup", kind: "kup", beltColour: "green", classesRequired: 20 },
      { name: "6th Gup", kind: "kup", beltColour: "green", classesRequired: 24 },
      { name: "5th Gup", kind: "kup", beltColour: "blue", classesRequired: 24 },
      { name: "4th Gup", kind: "kup", beltColour: "blue", classesRequired: 28 },
      { name: "3rd Gup", kind: "kup", beltColour: "red", classesRequired: 28 },
      { name: "2nd Gup", kind: "kup", beltColour: "red", classesRequired: 32 },
      { name: "1st Gup", kind: "kup", beltColour: "red", classesRequired: 40 },
      { name: "1st Dan", kind: "dan", beltColour: "black", classesRequired: 100 },
      { name: "2nd Dan", kind: "dan", beltColour: "black", classesRequired: 150 },
      { name: "3rd Dan", kind: "dan", beltColour: "black", classesRequired: 200 },
    ],
  },
};
