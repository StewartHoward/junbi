import { describe, expect, it } from "vitest";
import { GUIDES, relatedGuides } from "@/lib/guides";
import { INDEX, LANDINGS, landingPath, landingRef } from "@/lib/landing";
import { shrinkPhoto } from "@/data/website";

/* Checks on the public marketing pages: every page is complete, links resolve and copy follows the house style. */

const all = [...LANDINGS.map((l) => ({ name: landingPath(l), text: JSON.stringify(l) })), ...GUIDES.map((g) => ({ name: g.slug, text: JSON.stringify(g) }))];

describe("landing pages", () => {
  it("have unique paths", () => {
    const paths = LANDINGS.map(landingPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("have a title and description that fit in search results", () => {
    for (const l of LANDINGS) {
      expect(`${l.metaTitle} · Junbi`.length, l.slug).toBeLessThanOrEqual(65);
      expect(l.description.length, l.slug).toBeGreaterThan(70);
      expect(l.description.length, l.slug).toBeLessThanOrEqual(160);
    }
    for (const x of Object.values(INDEX)) expect(x.description.length).toBeLessThanOrEqual(160);
  });

  it("only link to pages and guides that exist", () => {
    for (const l of LANDINGS) {
      for (const r of l.related) expect(landingRef(r), `${l.slug} -> ${r}`).not.toBeNull();
      for (const g of l.guides) expect(GUIDES.some((x) => x.slug === g), `${l.slug} -> ${g}`).toBe(true);
    }
  });

  it("date every comparison table", () => {
    for (const l of LANDINGS.filter((x) => x.kind === "compare" && x.table)) expect(l.table!.note).toMatch(/checked \w+ 20\d\d/);
  });
});

describe("guides", () => {
  it("have unique slugs, tags and short summaries", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.tags.length, g.slug).toBeGreaterThan(0);
      expect(g.summary.length, g.slug).toBeLessThanOrEqual(160);
    }
  });

  it("suggest related guides, never themselves", () => {
    for (const g of GUIDES) {
      const r = relatedGuides(g);
      expect(r).toHaveLength(3);
      expect(r.map((x) => x.slug)).not.toContain(g.slug);
    }
  });
});

describe("house style", () => {
  it("uses no em dashes or exclamation marks in public copy", () => {
    for (const p of all) {
      expect(p.text, p.name).not.toContain("—");
      expect(p.text, p.name).not.toMatch(/!/);
    }
  });
});

describe("club website photos", () => {
  it("are shrunk to WebP, turned upright and stripped of metadata", async () => {
    const sharp = (await import("sharp")).default;
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c8102e" } })
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "Someone" } } })
      .jpeg()
      .toBuffer();
    const out = await shrinkPhoto(big);
    expect(out).not.toBeNull();
    const meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(out!.width, out!.height)).toBe(1800);
    expect(out!.width).toBeLessThan(out!.height); // rotated upright from orientation 6
    expect(meta.exif).toBeUndefined();
  });

  it("return null for something that isn't a photo, so the original is kept", async () => {
    expect(await shrinkPhoto(Buffer.from("not a photo"))).toBeNull();
  });
});
