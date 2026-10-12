import { describe, expect, it } from "vitest";
import { guessMapping, matchBelt, normaliseBelt, parseCsv, parseDate, parseStatus, splitName, type GradeRef } from "@/lib/import";

const wt: GradeRef[] = ["10th Kup:white", "9th Kup:yellow", "8th Kup:yellow", "7th Kup:green", "1st Kup:red", "1st Poom:red", "1st Dan:black", "2nd Dan:black"].map((x, i) => {
  const [name, beltColour] = x.split(":");
  return { id: String(i), name, discipline: "taekwondo", beltColour };
});
const kick: GradeRef[] = ["White belt:white", "Yellow belt:yellow", "Blue belt:blue"].map((x, i) => {
  const [name, beltColour] = x.split(":");
  return { id: `k${i}`, name, discipline: "kickboxing", beltColour };
});

describe("reading CSV files", () => {
  it("handles quotes, commas, new lines, a BOM, blank lines and semicolons", () => {
    expect(parseCsv('﻿Name,Notes\r\n"Taylor, Sam","Says ""hi""\nsecond line"\r\n\r\nAlex,\n')).toEqual([
      ["Name", "Notes"],
      ["Taylor, Sam", 'Says "hi"\nsecond line'],
      ["Alex", ""],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("guessing columns", () => {
  it("maps common export headings", () => {
    const m = guessMapping(["Student First Name", "Surname", "D.O.B", "Current Grade", "Location", "Parent Name", "Parent Email", "Mobile", "Medical Conditions", "Membership Status"]);
    expect(m).toEqual({ firstName: 0, lastName: 1, dateOfBirth: 2, belt: 3, site: 4, guardianName: 5, email: 6, phone: 7, medical: 8, status: 9 });
    expect(guessMapping(["Name", "Belt", "Email"])).toEqual({ fullName: 0, belt: 1, email: 2 });
  });
});

describe("values", () => {
  it("reads UK dates and Excel day numbers, and rejects nonsense", () => {
    const today = new Date("2026-10-10T12:00:00Z");
    expect(parseDate("14/03/2015", today)).toBe("2015-03-14");
    expect(parseDate("2015-03-14", today)).toBe("2015-03-14");
    expect(parseDate("1.2.18", today)).toBe("2018-02-01");
    expect(parseDate("3/4/88", today)).toBe("1988-04-03");
    expect(parseDate("42077", today)).toBe("2015-03-14");
    expect(parseDate("31/02/2015", today)).toBeNull();
    expect(parseDate("01/01/2030", today)).toBeNull();
    expect(parseDate("next week", today)).toBeNull();
  });
  it("splits names and reads statuses", () => {
    expect(splitName("Sam Taylor")).toEqual(["Sam", "Taylor"]);
    expect(splitName("Taylor, Sam")).toEqual(["Sam", "Taylor"]);
    expect(splitName("Mary Jane Smith")).toEqual(["Mary Jane", "Smith"]);
    expect(parseStatus("Active")).toBe("active");
    expect(parseStatus("Inactive")).toBe("cancelled");
    expect(parseStatus("Left")).toBe("cancelled");
    expect(parseStatus("On hold")).toBe("paused");
    expect(parseStatus("Free trial")).toBe("trial");
    expect(parseStatus("unknown")).toBeNull();
  });
});

describe("matching belts", () => {
  it("matches spellings clubs actually use", () => {
    expect(normaliseBelt("1st Keup (Red Belt)")).toBe("1 kup red");
    expect(matchBelt("10th kup", wt).grade?.name).toBe("10th Kup");
    expect(matchBelt("7th Keup Green", wt).grade?.name).toBe("7th Kup");
    expect(matchBelt("1st Gup", wt).grade?.name).toBe("1st Kup");
    expect(matchBelt("First Dan Black Belt", wt).grade?.name).toBe("1st Dan");
    expect(matchBelt("1 poom", wt).grade?.name).toBe("1st Poom");
    expect(matchBelt("white", wt).grade?.name).toBe("10th Kup");
    expect(matchBelt("Blue", kick).grade?.name).toBe("Blue belt");
  });
  it("says so when it has to pick, or can't find one", () => {
    const y = matchBelt("Yellow", wt);
    expect(y.grade?.name).toBe("9th Kup");
    expect(y.note).toMatch(/more than one/);
    const none = matchBelt("5th Dan", wt);
    expect(none.grade).toBeNull();
    expect(none.note).toMatch(/No belt/);
    expect(matchBelt("Purple", wt).grade).toBeNull();
  });
});

describe("address columns", () => {
  it("recognises address, town, postcode and emergency contact columns", async () => {
    const { guessMapping } = await import("@/lib/import");
    const m = guessMapping(["Student Name", "Address", "Town", "Post Code", "Emergency Contact", "Emergency Contact Phone", "Parent Mobile"]);
    expect(m).toMatchObject({ fullName: 0, address: 1, town: 2, postcode: 3, emergencyName: 4, emergencyPhone: 5, phone: 6 });
  });
});

describe("dates", () => {
  it("accepts real dates and rejects ones JavaScript would roll over", async () => {
    const { isRealDate } = await import("@/lib/dates");
    expect(isRealDate("2026-02-28")).toBe(true);
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2026-02-31")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("12/10/2026")).toBe(false);
    expect(isRealDate(null)).toBe(false);
  });
});
