import { describe, it, expect } from "vitest";
import { selectBoundary } from "@/lib/sources/represent";
import fixture from "../../fixtures/represent-postcode.json";

describe("selectBoundary", () => {
  it("prefers concordance boundaries over centroid", () => {
    const result = selectBoundary(fixture);
    expect(result?.matchType).toBe("concordance");
    expect(result?.boundary.name).toBe("Rivière-du-Nord");
  });

  it("falls back to centroid when concordance is empty", () => {
    const result = selectBoundary({
      boundaries_concordance: [],
      boundaries_centroid: [{ name: "Some Riding" }],
    });
    expect(result?.matchType).toBe("centroid");
    expect(result?.boundary.name).toBe("Some Riding");
  });

  it("returns null when both lists are empty or missing", () => {
    expect(selectBoundary({})).toBeNull();
    expect(selectBoundary({ boundaries_concordance: [], boundaries_centroid: [] })).toBeNull();
  });
});
