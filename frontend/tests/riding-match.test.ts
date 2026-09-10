import { describe, it, expect } from "vitest";
import { normalizeRidingName, ridingNamesMatch, findByRidingName } from "@/lib/riding-match";

describe("normalizeRidingName", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeRidingName("Rivière-du-Nord")).toBe(normalizeRidingName("riviere du nord"));
  });

  it("treats different dash glyphs the same", () => {
    expect(normalizeRidingName("Cypress Hills–Grasslands")).toBe(
      normalizeRidingName("Cypress Hills-Grasslands")
    );
  });
});

describe("ridingNamesMatch", () => {
  it("matches despite accent/case/dash differences", () => {
    expect(ridingNamesMatch("Rivière-du-Nord", "riviere-du-nord")).toBe(true);
  });

  it("does not match different ridings", () => {
    expect(ridingNamesMatch("Rivière-du-Nord", "Joliette")).toBe(false);
  });
});

describe("findByRidingName", () => {
  const candidates = [
    { slug: "a", ridingName: "Rivière-du-Nord" },
    { slug: "b", ridingName: null },
    { slug: "c", ridingName: "Joliette" },
  ];

  it("finds the matching candidate regardless of accents/case", () => {
    expect(findByRidingName("riviere du nord", candidates)?.slug).toBe("a");
  });

  it("returns null when nothing matches", () => {
    expect(findByRidingName("Nowhere", candidates)).toBeNull();
  });

  it("skips candidates with a null riding name rather than throwing", () => {
    expect(findByRidingName("", candidates)).toBeNull();
  });

  it("falls back to a substring match when a riding was renamed between sources", () => {
    // Real case hit in production: Represent returns "Hochelaga" for a
    // postal code; Open Parliament's current riding for that seat is
    // "Hochelaga—Rosemont-Est" post-redistribution.
    const renamed = [
      { slug: "d", ridingName: "Hochelaga—Rosemont-Est" },
      { slug: "e", ridingName: "Rosemont—La Petite-Patrie" },
    ];
    expect(findByRidingName("Hochelaga", renamed)?.slug).toBe("d");
  });

  it("prefers an exact match over a substring match when both exist", () => {
    const both = [
      { slug: "short", ridingName: "Hochelaga" },
      { slug: "long", ridingName: "Hochelaga—Rosemont-Est" },
    ];
    expect(findByRidingName("Hochelaga", both)?.slug).toBe("short");
  });
});
