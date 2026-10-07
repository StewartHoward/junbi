import { describe, expect, it } from "vitest";
import { can, canAtSite, assertCan, paymentNoticeFor, ForbiddenError, type Actor } from "@/auth/permissions";

const base = { userId: "u", clubId: "c" };
const owner: Actor = { ...base, role: "owner", sites: "all" };
const admin: Actor = { ...base, role: "admin", sites: "all" };
const instructor: Actor = { ...base, role: "instructor", sites: ["southport"] };
const assistant: Actor = { ...base, role: "assistant", sites: ["southport"] };

describe("permission matrix (from the developer brief)", () => {
  it("only the owner manages the club and its subscription", () => {
    expect(can(owner, "club.manage")).toBe(true);
    expect(can(admin, "club.manage")).toBe(false);
    expect(can(instructor, "club.manage")).toBe(false);
  });

  it("owners and admins manage staff and payments", () => {
    for (const a of [owner, admin]) {
      expect(can(a, "staff.manage")).toBe(true);
      expect(can(a, "payments.manage")).toBe(true);
      expect(can(a, "reports.view")).toBe(true);
    }
  });

  it("instructors teach but never see money", () => {
    expect(can(instructor, "register.take")).toBe(true);
    expect(can(instructor, "grading.record")).toBe(true);
    expect(can(instructor, "medical.view")).toBe(true);
    expect(can(instructor, "payments.view")).toBe(false);
    expect(can(instructor, "reports.view")).toBe(false);
  });

  it("assistants can only take registers", () => {
    expect(can(assistant, "register.take")).toBe(true);
    expect(can(assistant, "students.view")).toBe(false);
    expect(can(assistant, "medical.view")).toBe(false);
  });
});

describe("site scoping", () => {
  it("limits instructors to their assigned sites", () => {
    expect(canAtSite(instructor, "register.take", "southport")).toBe(true);
    expect(canAtSite(instructor, "register.take", "preston")).toBe(false);
  });

  it("lets all-site staff work anywhere", () => {
    expect(canAtSite(admin, "students.edit", "preston")).toBe(true);
  });

  it("assertCan throws ForbiddenError", () => {
    expect(() => assertCan(instructor, "payments.manage")).toThrow(ForbiddenError);
    expect(() => assertCan(instructor, "register.take", "preston")).toThrow(ForbiddenError);
    expect(() => assertCan(owner, "club.manage")).not.toThrow();
  });
});

describe("payment notices", () => {
  const issue = { hasIssue: true, detail: "Direct Debit cancelled · £56.00 due" };

  it("shows detail to owners and admins", () => {
    expect(paymentNoticeFor(admin, issue)).toBe(issue.detail);
  });

  it("shows only a neutral prompt to instructors and assistants", () => {
    expect(paymentNoticeFor(instructor, issue)).toBe("Please see the office");
    expect(paymentNoticeFor(assistant, issue)).toBe("Please see the office");
  });

  it("shows nothing when there's no issue", () => {
    expect(paymentNoticeFor(instructor, { hasIssue: false, detail: "" })).toBeNull();
  });
});
