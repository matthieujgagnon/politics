import { getDb } from "@/lib/db";
import { fetchJson } from "@/lib/http";

const BASE = "https://api.openparliament.ca";
const POLITICIAN_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const VOTES_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// --- Everything in this file was written against openparliament.ca's
// documented resource list (politicians / votes / bills / debates /
// committees, JSON, filterable) but NOT against a live response, because
// outbound network access to api.openparliament.ca was blocked in the
// sandbox this was built in. Field extraction below tries several
// plausible key paths per field and keeps the raw response cached
// alongside the parsed result, specifically so a wrong guess here doesn't
// lose data or crash - it just parses as null and the raw JSON is right
// there to fix the path from. `getPoliticianVotes` is the least certain
// piece (the ballots endpoint URL/params are a best guess) and degrades
// to an empty, clearly-marked-unavailable result rather than throwing.

export interface PoliticianSummary {
  slug: string;
  name: string;
  party: string | null;
  ridingName: string | null;
  photoUrl: string | null;
}

export interface VoteRecord {
  date: string | null;
  billNumber: string | null;
  description: string | null;
  position: string | null;
  sourceUrl: string | null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function slugFromUrl(url: string): string | null {
  const match = url.match(/\/politicians\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

/** Exported for direct unit testing against fixtures - see openparliament.test.ts. */
export function parsePoliticianSummary(entry: Record<string, unknown>): PoliticianSummary | null {
  const url = firstString(entry.url, dig(entry, ["related", "url"]) as string | undefined);
  const slug = (url && slugFromUrl(url)) ?? firstString(entry.slug);
  const name = firstString(entry.name);
  if (!slug || !name) return null;

  const party = firstString(
    dig(entry, ["party", "short_name", "en"]),
    dig(entry, ["current_party", "short_name", "en"]),
    dig(entry, ["party", "name", "en"]),
    entry.party
  );

  const ridingName = firstString(
    dig(entry, ["riding", "name", "en"]),
    dig(entry, ["current_riding", "name", "en"]),
    dig(entry, ["riding", "name"]),
    dig(entry, ["current_riding", "name"])
  );

  const photoUrl = firstString(entry.image, entry.photo_url);

  return { slug, name, party, ridingName, photoUrl };
}

export async function getCurrentPoliticians(): Promise<PoliticianSummary[]> {
  // Django/Tastypie-style list envelope ({meta, objects}) is the common
  // convention for this kind of API and matches this project's public
  // examples - not confirmed live, see file header.
  const data = await fetchJson<{ objects?: unknown[] }>(`${BASE}/politicians/?format=json`);
  const objects = Array.isArray(data.objects) ? data.objects : [];
  return objects
    .map((o) => parsePoliticianSummary(o as Record<string, unknown>))
    .filter((p): p is PoliticianSummary => p !== null);
}

export async function getPoliticianDetail(
  slug: string
): Promise<PoliticianSummary & { url: string; raw: unknown }> {
  const db = getDb();
  const cached = db
    .prepare("SELECT raw_detail, fetched_at FROM politicians WHERE slug = ?")
    .get(slug) as { raw_detail: string; fetched_at: string } | undefined;

  let raw: unknown;
  if (cached && Date.now() - Date.parse(cached.fetched_at) < POLITICIAN_CACHE_MAX_AGE_MS) {
    raw = JSON.parse(cached.raw_detail);
  } else {
    raw = await fetchJson(`${BASE}/politicians/${slug}/?format=json`);
    const parsed = parsePoliticianSummary(raw as Record<string, unknown>);
    db.prepare(
      `INSERT INTO politicians (slug, name, party, riding_name, photo_url, raw_detail, fetched_at)
       VALUES (@slug, @name, @party, @riding_name, @photo_url, @raw_detail, @fetched_at)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name, party = excluded.party, riding_name = excluded.riding_name,
         photo_url = excluded.photo_url, raw_detail = excluded.raw_detail, fetched_at = excluded.fetched_at`
    ).run({
      slug,
      name: parsed?.name ?? slug,
      party: parsed?.party ?? null,
      riding_name: parsed?.ridingName ?? null,
      photo_url: parsed?.photoUrl ?? null,
      raw_detail: JSON.stringify(raw),
      fetched_at: new Date().toISOString(),
    });
  }

  const parsed = parsePoliticianSummary(raw as Record<string, unknown>) ?? {
    slug,
    name: slug,
    party: null,
    ridingName: null,
    photoUrl: null,
  };
  const url = firstString((raw as Record<string, unknown>)?.url) ?? `/politicians/${slug}/`;
  return { ...parsed, url, raw };
}

export function parseVotesResponse(data: { objects?: unknown[] }): VoteRecord[] {
  const objects = Array.isArray(data.objects) ? data.objects : [];
  return objects.map((o) => {
    const entry = o as Record<string, unknown>;
    return {
      date: firstString(dig(entry, ["vote", "date"]), entry.date),
      billNumber: firstString(dig(entry, ["vote", "bill", "number"]), dig(entry, ["bill", "number"])),
      description: firstString(dig(entry, ["vote", "description", "en"]), dig(entry, ["description", "en"])),
      position: firstString(entry.ballot, entry.vote_value),
      sourceUrl: firstString(dig(entry, ["vote", "url"]), entry.url),
    };
  });
}

export async function getPoliticianVotes(
  slug: string,
  politicianUrl: string
): Promise<{ votes: VoteRecord[]; available: boolean }> {
  const db = getDb();
  const cached = db
    .prepare("SELECT raw_votes, fetched_at FROM politician_votes WHERE politician_slug = ?")
    .get(slug) as { raw_votes: string; fetched_at: string } | undefined;

  if (cached && Date.now() - Date.parse(cached.fetched_at) < VOTES_CACHE_MAX_AGE_MS) {
    return { votes: parseVotesResponse(JSON.parse(cached.raw_votes)), available: true };
  }

  try {
    const data = await fetchJson<{ objects?: unknown[] }>(
      `${BASE}/votes/ballots/?politician=${encodeURIComponent(politicianUrl)}&format=json&limit=20`
    );
    db.prepare(
      `INSERT INTO politician_votes (politician_slug, raw_votes, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(politician_slug) DO UPDATE SET raw_votes = excluded.raw_votes, fetched_at = excluded.fetched_at`
    ).run(slug, JSON.stringify(data), new Date().toISOString());
    return { votes: parseVotesResponse(data), available: true };
  } catch {
    // Best-effort endpoint guess failed - render the rest of the profile
    // rather than failing the whole page. See file header.
    return { votes: [], available: false };
  }
}
