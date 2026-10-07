import { z } from "zod";
import { PLAN_IDS } from "@/lib/plans";

export const STUDENT_BANDS = ["1-50", "51-150", "151-300", "300+"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Validation for the public Founding Club form. Shared by the server action and tests. */
export const signupSchema = z.object({
  clubName: z.string().trim().min(2, "Please enter your club's name.").max(120),
  contactName: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(200),
  phone: optionalText(40),
  activeStudents: z.enum(STUDENT_BANDS, { message: "Please choose roughly how many students you have." }),
  sites: z.coerce.number().int().min(1).max(50).default(1),
  currentSystem: optionalText(120),
  plan: z.enum(PLAN_IDS).nullable().optional(),
  consentToContact: z.literal(true, { message: "Please tick the box so we can contact you." }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export function parseSignupForm(form: FormData) {
  const plan = String(form.get("plan") ?? "");
  return signupSchema.safeParse({
    clubName: form.get("clubName") ?? "",
    contactName: form.get("contactName") ?? "",
    email: form.get("email") ?? "",
    phone: form.get("phone") ?? "",
    activeStudents: form.get("activeStudents") ?? "",
    sites: form.get("sites") || 1,
    currentSystem: form.get("currentSystem") ?? "",
    plan: (PLAN_IDS as readonly string[]).includes(plan) ? plan : null,
    consentToContact: form.get("consentToContact") === "on",
  });
}
