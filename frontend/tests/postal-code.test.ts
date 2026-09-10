import { describe, it, expect } from "vitest";
import { normalizePostalCode, formatPostalCode } from "@/lib/postal-code";

describe("normalizePostalCode", () => {
  it("accepts a properly formatted code", () => {
    expect(normalizePostalCode("K1A 0A6")).toBe("K1A0A6");
  });

  it("accepts lowercase and no space", () => {
    expect(normalizePostalCode("k1a0a6")).toBe("K1A0A6");
  });

  it("rejects excluded first letters", () => {
    expect(normalizePostalCode("D1A 0A6")).toBeNull();
    expect(normalizePostalCode("W1A 0A6")).toBeNull();
    expect(normalizePostalCode("Z1A 0A6")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(normalizePostalCode("hello")).toBeNull();
    expect(normalizePostalCode("")).toBeNull();
    expect(normalizePostalCode("12345")).toBeNull();
  });

  it("allows W/Z in non-first letter positions", () => {
    expect(normalizePostalCode("K1W 0A6")).toBe("K1W0A6");
  });
});

describe("formatPostalCode", () => {
  it("adds the space back in the right place", () => {
    expect(formatPostalCode("K1A0A6")).toBe("K1A 0A6");
  });
});
