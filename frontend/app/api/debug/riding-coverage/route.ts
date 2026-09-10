import { findByRidingName, normalizeRidingName } from "@/lib/riding-match";
import { getCurrentPoliticians } from "@/lib/sources/openparliament";
import { fetchJson } from "@/lib/http";

// Temporary diagnostic, not a permanent feature: checks how many of
// Represent's federal ridings resolve to a current MP via the real
// lib/riding-match.ts logic (not a reimplementation), across the actual
// data. Originally built to check whether the Hochelaga-style substring
// fallback generalizes; that investigation found the plain
// "federal-electoral-districts" set was stuck on 2017-era boundaries and
// pointed lib/sources/represent.ts at federal-electoral-districts-2023-
// representation-order instead. This now re-checks coverage against
// that same corrected set. Safe to delete once coverage looks right.

interface RepresentBoundary {
  name: string;
}
interface RepresentBoundariesResponse {
  objects?: RepresentBoundary[];
}

export async function GET() {
  const [boundariesData, politicians] = await Promise.all([
    fetchJson<RepresentBoundariesResponse>(
      "https://represent.opennorth.ca/boundaries/federal-electoral-districts-2023-representation-order/?format=json&limit=400"
    ),
    getCurrentPoliticians(),
  ]);

  const boundaries = boundariesData.objects ?? [];
  const unmatched: { representRiding: string; normalized: string }[] = [];

  for (const b of boundaries) {
    const match = findByRidingName(b.name, politicians);
    if (!match) unmatched.push({ representRiding: b.name, normalized: normalizeRidingName(b.name) });
  }

  const openParliamentRidingNames = politicians
    .map((p) => p.ridingName)
    .filter((n): n is string => n !== null)
    .sort((a, b) => a.localeCompare(b));

  return Response.json({
    totalRidingsChecked: boundaries.length,
    totalCurrentPoliticians: politicians.length,
    matchedCount: boundaries.length - unmatched.length,
    unmatched,
    openParliamentRidingNames,
  });
}
