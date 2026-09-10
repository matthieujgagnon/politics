// Canadian postal code format: A1A 1A1. Letter positions (1st, 3rd, 5th)
// exclude D, F, I, O, Q, U always; the first letter additionally excludes
// W and Z (not yet assigned). Digit positions (2nd, 4th, 6th) are 0-9.
const POSTAL_CODE_RE =
  /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s*(\d[ABCEGHJ-NPRSTV-Z]\d)$/i;

/** Returns the normalized no-space uppercase form (e.g. "K1A0A6"), or null if invalid. */
export function normalizePostalCode(raw: string): string | null {
  const match = raw.trim().toUpperCase().match(POSTAL_CODE_RE);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

export function formatPostalCode(normalized: string): string {
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}
