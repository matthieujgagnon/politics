// Represent (postal code -> riding) and Open Parliament (riding -> MP) are
// independently-maintained datasets with no shared ID, so matching a riding
// name across them is a text-matching problem, not a lookup by key: accents,
// en/em dashes vs. hyphens, and "St." vs "Saint" all vary between sources.
export function normalizeRidingName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[‐-―]/g, "-") // various dash glyphs -> ascii hyphen
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function ridingNamesMatch(a: string, b: string): boolean {
  return normalizeRidingName(a) === normalizeRidingName(b);
}

export function findByRidingName<T extends { ridingName: string | null }>(
  ridingName: string,
  candidates: T[]
): T | null {
  const target = normalizeRidingName(ridingName);
  return candidates.find((c) => c.ridingName !== null && normalizeRidingName(c.ridingName) === target) ?? null;
}
