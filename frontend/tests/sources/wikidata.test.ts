import { describe, it, expect } from "vitest";
import {
  claimItemId,
  claimString,
  isCurrentOrFormerMp,
  isCurrentClaim,
  wikipediaUrl,
  type WbEntity,
} from "@/lib/sources/wikidata";
import entityFixture from "../../fixtures/wikidata-entity.json";

const entity = entityFixture as unknown as WbEntity;

describe("claimItemId / claimString", () => {
  it("extracts an item id from an item-valued claim", () => {
    expect(claimItemId(entity.claims!.P39[0])).toBe("Q15964890");
  });

  it("extracts a string from a string-valued claim", () => {
    expect(claimString(entity.claims!.P2002[0])).toBe("janetestmp");
  });

  it("returns null rather than throwing on the wrong kind of claim", () => {
    expect(claimString(entity.claims!.P39[0])).toBeNull();
    expect(claimItemId(entity.claims!.P2002[0])).toBeNull();
  });
});

describe("isCurrentOrFormerMp", () => {
  it("is true when a P39 claim points at the MP position (Q15964890)", () => {
    expect(isCurrentOrFormerMp(entity)).toBe(true);
  });

  it("is false with no matching P39 claim", () => {
    expect(isCurrentOrFormerMp({ id: "Q1", claims: {} })).toBe(false);
    expect(isCurrentOrFormerMp({ id: "Q1" })).toBe(false);
  });
});

describe("isCurrentClaim", () => {
  it("treats a P39 claim with no P582 (end time) qualifier as current", () => {
    expect(isCurrentClaim(entity.claims!.P39[1])).toBe(true);
  });
});

describe("wikipediaUrl", () => {
  it("builds a URL from a sitelink title, encoding spaces as underscores", () => {
    expect(wikipediaUrl(entity, "enwiki", "en.wikipedia.org")).toBe(
      "https://en.wikipedia.org/wiki/Jane_Test-MP"
    );
  });

  it("returns null when the sitelink is missing", () => {
    expect(wikipediaUrl({ id: "Q1" }, "enwiki", "en.wikipedia.org")).toBeNull();
  });
});
