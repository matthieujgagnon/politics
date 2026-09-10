import { findByRidingName } from "@/lib/riding-match";
import { getCurrentPoliticians } from "@/lib/sources/openparliament";
import { fetchJson } from "@/lib/http";

// Temporary diagnostic, not a permanent feature: checks how many of
// Represent's federal ridings resolve to a current MP via the real
// lib/riding-match.ts logic (not a reimplementation), across the actual
// data. Built to answer one question - does the Hochelaga-style
// substring fallback generalize, or was that a one-off? - and safe to
// delete once that's confirmed.
//
// The boundaries list endpoint/shape below is a best-effort guess, same
// caveat as the rest of lib/sources/*.ts: not confirmed live before this
// was written. If it 404s or comes back oddly shaped, that's the first
// thing to check.

interface RepresentBoundary {
  name: string;
}
interface RepresentBoundariesResponse {
  objects?: RepresentBoundary[];
}

export async function GET() {
  const [boundariesData, politicians] = await Promise.all([
    fetchJson<RepresentBoundariesResponse>(
      "https://represent.opennorth.ca/boundaries/federal-electoral-districts/?format=json&limit=400"
    ),
    getCurrentPoliticians(),
  ]);

  const boundaries = boundariesData.objects ?? [];
  const unmatchedRidings: string[] = [];

  for (const b of boundaries) {
    const match = findByRidingName(b.name, politicians);
    if (!match) unmatchedRidings.push(b.name);
  }

  return Response.json({
    totalRidingsChecked: boundaries.length,
    totalCurrentPoliticians: politicians.length,
    matchedCount: boundaries.length - unmatchedRidings.length,
    unmatchedRidings,
  });
}
