import { getDb } from "@/lib/db";
import { fetchJson } from "@/lib/http";
import { normalizePostalCode } from "@/lib/postal-code";

const REPRESENT_BASE = "https://represent.opennorth.ca";
const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // riding boundaries change only at redistribution

export interface RidingLookupResult {
  ridingName: string;
  province: string | null;
  matchType: "concordance" | "centroid";
}

interface RepresentBoundary {
  name: string;
  // Confirmed from the Represent API docs/browser examples: `name` is the
  // one field we rely on. `province`/`code` below are commonly present on
  // Represent boundary resources but have NOT been confirmed against a
  // live response in this environment (network was blocked while this was
  // built) - treat as best-effort and verify before depending on them.
  province?: string;
  code?: string;
}

interface RepresentPostcodeResponse {
  boundaries_concordance?: RepresentBoundary[];
  boundaries_centroid?: RepresentBoundary[];
}

class RidingNotFoundError extends Error {
  constructor(postalCode: string) {
    super(`No federal electoral district found for postal code ${postalCode}`);
    this.name = "RidingNotFoundError";
  }
}

export { RidingNotFoundError };

/** Pulled out for direct unit testing against fixtures - see represent.test.ts. */
export function selectBoundary(
  data: RepresentPostcodeResponse
): { boundary: RepresentBoundary; matchType: "concordance" | "centroid" } | null {
  const concordance = data.boundaries_concordance ?? [];
  const centroid = data.boundaries_centroid ?? [];
  if (concordance.length > 0) return { boundary: concordance[0], matchType: "concordance" };
  if (centroid.length > 0) return { boundary: centroid[0], matchType: "centroid" };
  return null;
}

export async function lookupRidingByPostalCode(rawPostalCode: string): Promise<RidingLookupResult> {
  const normalized = normalizePostalCode(rawPostalCode);
  if (!normalized) {
    throw new Error(`Not a valid Canadian postal code: ${rawPostalCode}`);
  }

  const db = getDb();
  const cached = db
    .prepare("SELECT riding_name, province, fetched_at FROM postal_code_lookups WHERE postal_code = ?")
    .get(normalized) as { riding_name: string; province: string | null; fetched_at: string } | undefined;

  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MAX_AGE_MS) {
    return { ridingName: cached.riding_name, province: cached.province, matchType: "concordance" };
  }

  const url = `${REPRESENT_BASE}/postcodes/${normalized}/?sets=federal-electoral-districts&format=json`;
  const data = await fetchJson<RepresentPostcodeResponse>(url);

  // Represent docs: concordance boundaries come from official government
  // data; centroid boundaries are "whatever boundary contains the postal
  // code's center point" and are the fallback when concordance is empty.
  const selected = selectBoundary(data);
  if (!selected) {
    throw new RidingNotFoundError(normalized);
  }

  const result: RidingLookupResult = {
    ridingName: selected.boundary.name,
    province: selected.boundary.province ?? null,
    matchType: selected.matchType,
  };

  db.prepare(
    `INSERT INTO postal_code_lookups (postal_code, riding_name, province, raw_response, fetched_at)
     VALUES (@postal_code, @riding_name, @province, @raw_response, @fetched_at)
     ON CONFLICT(postal_code) DO UPDATE SET
       riding_name = excluded.riding_name,
       province = excluded.province,
       raw_response = excluded.raw_response,
       fetched_at = excluded.fetched_at`
  ).run({
    postal_code: normalized,
    riding_name: result.ridingName,
    province: result.province,
    raw_response: JSON.stringify(data),
    fetched_at: new Date().toISOString(),
  });

  return result;
}
