import { getDb } from "@/lib/db";
import { fetchJson } from "@/lib/http";
import { normalizeRidingName } from "@/lib/riding-match";

const WD_API = "https://www.wikidata.org/w/api.php";
const POSITION_MP = "Q15964890"; // "member of the House of Commons of Canada" - used as a P39 (position held) value
const ELECTORAL_DISTRICT_QUALIFIER = "P768"; // qualifier on P39 naming which riding
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Property IDs for social links are well-established, long-stable Wikidata
// properties (high confidence from general knowledge); P768 as a qualifier
// on P39 for "which riding" is a reasonable, common pattern but - like
// everything touching a live endpoint in this file - was not confirmed
// against a real MP's Wikidata item, since Wikidata was unreachable from
// the sandbox this was built in. Spot-check against a couple of real MPs
// before relying on the riding-disambiguation path.

// Exported types/helpers below are for direct unit testing against
// fixtures - see wikidata.test.ts.
export interface WbClaim {
  mainsnak?: { datavalue?: { value: unknown } };
  qualifiers?: Record<string, WbClaim[]>;
}
export interface WbEntity {
  id: string;
  claims?: Record<string, WbClaim[]>;
  sitelinks?: Record<string, { title: string }>;
}

export function claimItemId(claim: WbClaim): string | null {
  const v = claim.mainsnak?.datavalue?.value as { id?: string } | undefined;
  return v?.id ?? null;
}
export function claimString(claim: WbClaim): string | null {
  const v = claim.mainsnak?.datavalue?.value;
  return typeof v === "string" ? v : null;
}
function claimStringFor(entity: WbEntity, prop: string): string | null {
  const claim = entity.claims?.[prop]?.[0];
  return claim ? claimString(claim) : null;
}

async function searchCandidates(name: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(
    name
  )}&language=en&format=json&type=item&limit=10`;
  const data = await fetchJson<{ search?: { id: string }[] }>(url);
  return (data.search ?? []).map((s) => s.id);
}

async function fetchEntities(ids: string[]): Promise<Record<string, WbEntity>> {
  if (ids.length === 0) return {};
  const url = `${WD_API}?action=wbgetentities&ids=${ids.join("|")}&props=claims|sitelinks&format=json`;
  const data = await fetchJson<{ entities?: Record<string, WbEntity> }>(url);
  return data.entities ?? {};
}

async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const labels: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const url = `${WD_API}?action=wbgetentities&ids=${chunk.join(
      "|"
    )}&props=labels&languages=en&format=json`;
    const data = await fetchJson<{
      entities?: Record<string, { labels?: { en?: { value: string } } }>;
    }>(url);
    for (const [id, ent] of Object.entries(data.entities ?? {})) {
      const label = ent.labels?.en?.value;
      if (label) labels[id] = label;
    }
  }
  return labels;
}

export function isCurrentOrFormerMp(entity: WbEntity): boolean {
  return (entity.claims?.P39 ?? []).some((c) => claimItemId(c) === POSITION_MP);
}

// Wikidata convention: a P39 (position held) statement with no P582
// (end time) qualifier is treated as currently held.
export function isCurrentClaim(claim: WbClaim): boolean {
  return !claim.qualifiers?.P582;
}

/** Finds the Wikidata item for a Canadian MP, cross-referencing by riding when the name alone is ambiguous. */
export async function findMpWikidataId(name: string, ridingName: string): Promise<string | null> {
  const candidateIds = await searchCandidates(name);
  if (candidateIds.length === 0) return null;

  const entities = await fetchEntities(candidateIds);
  const mpCandidates = Object.values(entities).filter(isCurrentOrFormerMp);
  if (mpCandidates.length === 0) return null;
  if (mpCandidates.length === 1) return mpCandidates[0].id;

  const districtIds: string[] = [];
  for (const ent of mpCandidates) {
    for (const claim of ent.claims?.P39 ?? []) {
      const districtId = claim.qualifiers?.[ELECTORAL_DISTRICT_QUALIFIER]?.[0]
        ? claimItemId(claim.qualifiers[ELECTORAL_DISTRICT_QUALIFIER][0])
        : null;
      if (districtId) districtIds.push(districtId);
    }
  }
  const districtLabels = await resolveLabels(districtIds);
  const target = normalizeRidingName(ridingName);

  for (const ent of mpCandidates) {
    for (const claim of ent.claims?.P39 ?? []) {
      const districtId = claim.qualifiers?.[ELECTORAL_DISTRICT_QUALIFIER]?.[0]
        ? claimItemId(claim.qualifiers[ELECTORAL_DISTRICT_QUALIFIER][0])
        : null;
      const label = districtId ? districtLabels[districtId] : null;
      if (label && normalizeRidingName(label) === target) return ent.id;
    }
  }

  // Ambiguous and un-disambiguated by riding: fall back to the first match
  // rather than fail outright. Flagged in code, not surfaced to the UI yet
  // - worth adding a "match confidence" field if this proves common.
  return mpCandidates[0].id;
}

export interface WikidataMpProfile {
  wikidataId: string | null;
  wikipediaUrl: string | null;
  wikipediaUrlFr: string | null;
  officialWebsite: string | null;
  social: {
    twitter: string | null;
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
  };
  careerBackground: string[];
  /** Labels of P39 (position held) statements with no end date, i.e. currently held - candidate signal for role-based salary add-ons. Heuristic, not a verified structured lookup; see lib/sources/salary.ts. */
  currentPositionLabels: string[];
}

const EMPTY_PROFILE: WikidataMpProfile = {
  wikidataId: null,
  wikipediaUrl: null,
  wikipediaUrlFr: null,
  officialWebsite: null,
  social: { twitter: null, instagram: null, facebook: null, linkedin: null },
  careerBackground: [],
  currentPositionLabels: [],
};

export function wikipediaUrl(entity: WbEntity, siteKey: "enwiki" | "frwiki", host: string): string | null {
  const title = entity.sitelinks?.[siteKey]?.title;
  return title ? `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : null;
}

export async function getMpWikidataProfile(
  politicianSlug: string,
  name: string,
  ridingName: string
): Promise<WikidataMpProfile> {
  const db = getDb();
  const cached = db
    .prepare("SELECT wikidata_id, raw_entity, fetched_at FROM wikidata_profiles WHERE politician_slug = ?")
    .get(politicianSlug) as { wikidata_id: string | null; raw_entity: string | null; fetched_at: string } | undefined;

  let wikidataId: string | null;
  let entity: WbEntity | null;

  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MAX_AGE_MS) {
    wikidataId = cached.wikidata_id;
    entity = cached.raw_entity ? (JSON.parse(cached.raw_entity) as WbEntity) : null;
  } else {
    wikidataId = await findMpWikidataId(name, ridingName);
    entity = wikidataId ? (await fetchEntities([wikidataId]))[wikidataId] ?? null : null;
    db.prepare(
      `INSERT INTO wikidata_profiles (politician_slug, wikidata_id, raw_entity, fetched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(politician_slug) DO UPDATE SET
         wikidata_id = excluded.wikidata_id, raw_entity = excluded.raw_entity, fetched_at = excluded.fetched_at`
    ).run(politicianSlug, wikidataId, entity ? JSON.stringify(entity) : null, new Date().toISOString());
  }

  if (!entity) return EMPTY_PROFILE;

  const twitterHandle = claimStringFor(entity, "P2002");
  const instagramHandle = claimStringFor(entity, "P2003");
  const facebookId = claimStringFor(entity, "P2013");
  const linkedinId = claimStringFor(entity, "P6634");

  const occupationIds = (entity.claims?.P106 ?? []).map(claimItemId).filter((x): x is string => !!x);
  const otherPositionClaims = (entity.claims?.P39 ?? []).filter((c) => claimItemId(c) !== POSITION_MP);
  const otherPositionIds = otherPositionClaims.map(claimItemId).filter((x): x is string => !!x);
  const currentPositionIds = otherPositionClaims
    .filter(isCurrentClaim)
    .map(claimItemId)
    .filter((x): x is string => !!x);
  const labelMap = await resolveLabels([...occupationIds, ...otherPositionIds]);
  const careerBackground = [...occupationIds, ...otherPositionIds]
    .map((id) => labelMap[id])
    .filter((x): x is string => !!x);
  const currentPositionLabels = currentPositionIds.map((id) => labelMap[id]).filter((x): x is string => !!x);

  return {
    wikidataId: entity.id,
    wikipediaUrl: wikipediaUrl(entity, "enwiki", "en.wikipedia.org"),
    wikipediaUrlFr: wikipediaUrl(entity, "frwiki", "fr.wikipedia.org"),
    officialWebsite: claimStringFor(entity, "P856"),
    social: {
      twitter: twitterHandle ? `https://x.com/${twitterHandle}` : null,
      instagram: instagramHandle ? `https://instagram.com/${instagramHandle}` : null,
      facebook: facebookId ? `https://facebook.com/${facebookId}` : null,
      // Deliberately link out rather than scrape LinkedIn directly (ToS + auth wall).
      linkedin: linkedinId ? `https://www.linkedin.com/in/${linkedinId}` : null,
    },
    careerBackground,
    currentPositionLabels,
  };
}
