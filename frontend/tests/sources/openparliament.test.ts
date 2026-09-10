import { describe, it, expect } from "vitest";
import { parsePoliticianSummary, parseVotesResponse } from "@/lib/sources/openparliament";
import politicians from "../../fixtures/openparliament-politicians.json";
import votes from "../../fixtures/openparliament-votes.json";

describe("parsePoliticianSummary", () => {
  it("extracts slug/name/party/riding/photo from a full entry", () => {
    const entry = politicians.objects[0] as Record<string, unknown>;
    expect(parsePoliticianSummary(entry)).toEqual({
      slug: "jane-test-mp",
      name: "Jane Test-MP",
      party: "Liberal",
      ridingName: "Rivière-du-Nord",
      photoUrl: "https://example.org/photos/jane-test-mp.jpg",
    });
  });

  it("returns null when there's no name or slug to identify the entry", () => {
    expect(parsePoliticianSummary({})).toBeNull();
  });

  it("returns nulls for missing optional fields rather than throwing", () => {
    const entry = politicians.objects[1] as Record<string, unknown>;
    const result = parsePoliticianSummary(entry);
    expect(result?.slug).toBe("no-riding-person");
    expect(result?.ridingName).toBeNull();
    expect(result?.party).toBeNull();
    expect(result?.photoUrl).toBeNull();
  });
});

describe("parseVotesResponse", () => {
  it("extracts vote records from both nested (vote.*) and flat shapes", () => {
    const result = parseVotesResponse(votes);
    expect(result).toEqual([
      {
        date: "2026-03-12",
        billNumber: "C-211",
        description: "An Act to amend the National Housing Strategy",
        position: "Yes",
        sourceUrl: "/votes/45-1/123/",
      },
      {
        date: "2026-02-26",
        billNumber: "C-198",
        description: "Budget Implementation Act",
        position: "No",
        sourceUrl: "/votes/45-1/110/",
      },
    ]);
  });

  it("returns an empty array when the response has no objects", () => {
    expect(parseVotesResponse({})).toEqual([]);
  });
});
