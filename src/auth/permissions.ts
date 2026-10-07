/**
 * Junbi roles and permissions, straight from the developer brief's matrix.
 * Every server action and page checks these before touching data.
 */

export const ROLES = ["owner", "admin", "instructor", "assistant"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "club.manage", // club settings, plan, Junbi subscription
  "staff.manage", // add or remove staff
  "students.view",
  "students.edit",
  "medical.view",
  "payments.view",
  "payments.manage", // charges, refunds, plan changes
  "register.take",
  "grading.record", // grading scores, syllabus ticks
  "messages.send",
  "reports.view",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  owner: new Set(CAPABILITIES),
  admin: new Set(CAPABILITIES.filter((c) => c !== "club.manage")),
  instructor: new Set<Capability>([
    "students.view",
    "students.edit",
    "medical.view",
    "register.take",
    "grading.record",
    "messages.send",
  ]),
  assistant: new Set<Capability>(["register.take"]),
};

/** The signed-in staff member, resolved for one club. */
export type Actor = {
  userId: string;
  clubId: string;
  role: Role;
  /** "all" for staff who cover every site, otherwise the site ids they're assigned to. */
  sites: "all" | readonly string[];
};

export function can(actor: Actor, capability: Capability): boolean {
  return MATRIX[actor.role].has(capability);
}

/** True when the actor has the capability AND covers the given site. */
export function canAtSite(actor: Actor, capability: Capability, siteId: string): boolean {
  if (!can(actor, capability)) return false;
  return actor.sites === "all" || actor.sites.includes(siteId);
}

export class ForbiddenError extends Error {
  constructor(capability: Capability) {
    super(`Not allowed: ${capability}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(actor: Actor, capability: Capability, siteId?: string): void {
  const ok = siteId ? canAtSite(actor, capability, siteId) : can(actor, capability);
  if (!ok) throw new ForbiddenError(capability);
}

/**
 * What staff see about a family's payments. Owners and admins get the detail;
 * instructors and assistants only ever see a neutral prompt, never amounts or reasons.
 */
export function paymentNoticeFor(
  actor: Actor,
  issue: { hasIssue: boolean; detail: string },
): string | null {
  if (!issue.hasIssue) return null;
  return can(actor, "payments.view") ? issue.detail : "Please see the office";
}
