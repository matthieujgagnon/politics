import { describe, it, expect } from "vitest";
import { parsePoliticianSummary, parseBallotsResponse, parseVoteDetail } from "@/lib/sources/openparliament";
import politicians from "../../fixtures/openparliament-politicians.json";
import ballots from "../../fixtures/openparliament-votes.json";
import voteDetail from "../../fixtures/openparliament-vote-detail.json";

describe("parsePoliticianSummary", () => {
  it("extracts slug/name/party/riding from a full entry, and makes the relative photo path absolute", () => {
    const entry = politicians.objects[0] as Record<string, unknown>;
    expect(parsePoliticianSummary(entry)).toEqual({
      slug: "jane-test-mp",
      name: "Jane Test-MP",
      party: "Liberal",
      ridingName: "Rivière-du-Nord",
      photoUrl: "https://openparliament.ca/media/polpics/jane-test-mp.jpg",
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

describe("parseBallotsResponse", () => {
  it("extracts vote_url and ballot position from each entry", () => {
    expect(parseBallotsResponse(ballots)).toEqual([
      { voteUrl: "/votes/45-1/173/", position: "Yes" },
      { voteUrl: "/votes/45-1/110/", position: "No" },
    ]);
  });

  it("returns an empty array when the response has no objects", () => {
    expect(parseBallotsResponse({})).toEqual([]);
  });

  it("skips an entry with no vote_url rather than producing a broken row", () => {
    expect(parseBallotsResponse({ objects: [{ ballot: "Yes" }] })).toEqual([]);
  });
});

describe("parseVoteDetail", () => {
  it("extracts date, bill number (from bill_url), description, and an absolute source URL", () => {
    expect(parseVoteDetail(voteDetail)).toEqual({
      date: "2026-06-18",
      billNumber: "C-30",
      description:
        "3rd reading and adoption of Bill C-30, An Act to implement certain provisions of the spring economic update tabled in Parliament on April 28, 2026",
      sourceUrl: "https://openparliament.ca/votes/45-1/173/",
    });
  });

  it("returns nulls for missing fields rather than throwing", () => {
    expect(parseVoteDetail({})).toEqual({
      date: null,
      billNumber: null,
      description: null,
      sourceUrl: null,
    });
  });
});
