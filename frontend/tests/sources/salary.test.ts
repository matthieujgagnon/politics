import { describe, it, expect } from "vitest";
import { computeMpSalary, inferRoleKeysFromPositionLabels } from "@/lib/sources/salary";

describe("inferRoleKeysFromPositionLabels", () => {
  it("matches known role keywords", () => {
    expect(inferRoleKeysFromPositionLabels(["Minister of Housing"])).toEqual(["cabinet_minister"]);
    expect(
      inferRoleKeysFromPositionLabels(["Parliamentary Secretary to the Minister of Finance"])
    ).toEqual(["parliamentary_secretary"]);
  });

  it("returns an empty array for an ordinary backbench MP", () => {
    expect(inferRoleKeysFromPositionLabels(["Lawyer"])).toEqual([]);
    expect(inferRoleKeysFromPositionLabels([])).toEqual([]);
  });

  it("dedupes repeated matches", () => {
    expect(inferRoleKeysFromPositionLabels(["Whip", "Government Whip"])).toEqual(["whip"]);
  });
});

describe("computeMpSalary", () => {
  it("always includes base pay", () => {
    const result = computeMpSalary([]);
    expect(result.lines.map((l) => l.key)).toEqual(["base"]);
    expect(result.totalCad).toBeGreaterThan(0);
  });

  it("adds role add-on lines on top of base", () => {
    const result = computeMpSalary(["cabinet_minister"]);
    expect(result.lines.map((l) => l.key)).toEqual(["base", "cabinet_minister"]);
    expect(result.totalCad).toBe(
      result.lines.reduce((sum, l) => sum + l.amountCad, 0)
    );
  });

  it("ignores an unknown role key rather than throwing", () => {
    const result = computeMpSalary(["not_a_real_role"]);
    expect(result.lines.map((l) => l.key)).toEqual(["base"]);
  });

  it("flags the total as unverified while seed data lacks a live-confirmed figure", () => {
    // Documents current state: the base rate is seeded with verified:false
    // until `npm run refresh:salary` runs somewhere with network access.
    // If this starts failing after a real refresh, that's good news - update it.
    const result = computeMpSalary([]);
    expect(result.allVerified).toBe(false);
  });
});
