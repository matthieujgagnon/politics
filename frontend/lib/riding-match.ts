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

  const exact = candidates.find((c) => c.ridingName !== null && normalizeRidingName(c.ridingName) === target);
  if (exact) return exact;
  if (target.length === 0) return null; // avoid an empty target matching everything as a substring

  // Confirmed live (2026-09): Represent and Open Parliament can give a
  // riding two genuinely different names, not just different formatting -
  // e.g. Represent's "Hochelaga" vs. Open Parliament's post-redistribution
  // "Hochelaga—Rosemont-Est". Normalization alone can't fix that; fall
  // back to a substring match, since a rename like this is (so far,
  // observed once) one name extending the other rather than replacing it
  // outright.
  return (
    candidates.find((c) => {
      if (c.ridingName === null) return false;
      const candidate = normalizeRidingName(c.ridingName);
      return candidate.length > 0 && (candidate.includes(target) || target.includes(candidate));
    }) ?? null
  );
}
