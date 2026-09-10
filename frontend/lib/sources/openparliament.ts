import { getDb } from "@/lib/db";
import { fetchJson } from "@/lib/http";

const BASE = "https://api.openparliament.ca";
const POLITICIAN_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BALLOTS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// --- Politician list/detail and the vote-ballots/vote-detail shapes
// below are confirmed against live responses (2026-09). Field extraction
// still tries a couple of plausible fallback paths per field where the
// live shape wasn't checked for every entry, and keeps the raw response
// cached alongside the parsed result, so a wrong guess doesn't lose data
// or crash - it just parses as null and the raw JSON is right there to
// fix the path from.

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

// Confirmed live (2026-09): both photo paths and page URLs (vote pages,
// etc.) come back site-relative ("/media/polpics/...", "/votes/45-1/173/")
// rather than absolute, so they need a domain to actually load/link
// correctly in a browser. openparliament.ca (not the api. subdomain) is
// confirmed correct for photos (visually verified after deploy); using
// the same origin for other relative page paths since they're all part
// of the same canonical site.
const SITE_ORIGIN = "https://openparliament.ca";

function withSiteOrigin(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
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

  const photoUrl = withSiteOrigin(firstString(entry.image, entry.photo_url));

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

interface Ballot {
  voteUrl: string;
  position: string | null;
}

/** Exported for direct unit testing against fixtures - see openparliament.test.ts. */
export function parseBallotsResponse(data: { objects?: unknown[] }): Ballot[] {
  const objects = Array.isArray(data.objects) ? data.objects : [];
  return objects
    .map((o) => {
      const entry = o as Record<string, unknown>;
      const voteUrl = firstString(entry.vote_url);
      return voteUrl ? { voteUrl, position: firstString(entry.ballot) } : null;
    })
    .filter((b): b is Ballot => b !== null);
}

function billNumberFromUrl(url: string | null): string | null {
  // "/bills/45-1/C-30/" -> "C-30"
  return url?.match(/\/bills\/[^/]+\/([^/]+)\/?$/)?.[1] ?? null;
}

/** Exported for direct unit testing against fixtures - see openparliament.test.ts. */
export function parseVoteDetail(raw: Record<string, unknown>): Omit<VoteRecord, "position"> {
  return {
    date: firstString(raw.date),
    billNumber: billNumberFromUrl(firstString(raw.bill_url)),
    description: firstString(dig(raw, ["description", "en"])),
    sourceUrl: withSiteOrigin(firstString(raw.url)),
  };
}

async function getVoteDetail(voteUrl: string): Promise<Omit<VoteRecord, "position">> {
  const db = getDb();
  // No TTL: a recorded vote's facts don't change once cast.
  const cached = db.prepare("SELECT raw_detail FROM vote_details WHERE vote_url = ?").get(voteUrl) as
    | { raw_detail: string }
    | undefined;
  if (cached) return parseVoteDetail(JSON.parse(cached.raw_detail));

  const raw = (await fetchJson(`${BASE}${voteUrl}?format=json`)) as Record<string, unknown>;
  db.prepare(
    `INSERT INTO vote_details (vote_url, raw_detail, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(vote_url) DO UPDATE SET raw_detail = excluded.raw_detail, fetched_at = excluded.fetched_at`
  ).run(voteUrl, JSON.stringify(raw), new Date().toISOString());
  return parseVoteDetail(raw);
}

export async function getPoliticianVotes(
  slug: string,
  politicianUrl: string
): Promise<{ votes: VoteRecord[]; available: boolean }> {
  const db = getDb();
  const cached = db
    .prepare("SELECT raw_votes, fetched_at FROM politician_votes WHERE politician_slug = ?")
    .get(slug) as { raw_votes: string; fetched_at: string } | undefined;

  let ballots: Ballot[];
  if (cached && Date.now() - Date.parse(cached.fetched_at) < BALLOTS_CACHE_MAX_AGE_MS) {
    ballots = parseBallotsResponse(JSON.parse(cached.raw_votes));
  } else {
    try {
      const data = await fetchJson<{ objects?: unknown[] }>(
        `${BASE}/votes/ballots/?politician=${encodeURIComponent(politicianUrl)}&format=json&limit=20`
      );
      db.prepare(
        `INSERT INTO politician_votes (politician_slug, raw_votes, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(politician_slug) DO UPDATE SET raw_votes = excluded.raw_votes, fetched_at = excluded.fetched_at`
      ).run(slug, JSON.stringify(data), new Date().toISOString());
      ballots = parseBallotsResponse(data);
    } catch {
      return { votes: [], available: false };
    }
  }

  try {
    const details = await Promise.all(ballots.map((b) => getVoteDetail(b.voteUrl)));
    return { votes: ballots.map((b, i) => ({ ...details[i], position: b.position })), available: true };
  } catch {
    // Ballots list came through but per-vote detail fetches failed -
    // degrade to position-only rows rather than losing the whole table.
    return {
      votes: ballots.map((b) => ({ date: null, billNumber: null, description: null, sourceUrl: null, position: b.position })),
      available: true,
    };
  }
}
