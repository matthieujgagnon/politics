-- Cache tables for the postal-code -> MP profile flow.
-- Each table is the cache for exactly one external lookup, keyed so a
-- repeat request for the same postal code / politician / role doesn't
-- re-hit the external API.

CREATE TABLE IF NOT EXISTS postal_code_lookups (
  postal_code TEXT PRIMARY KEY,     -- normalized, no space, e.g. "K1A0A6"
  riding_name TEXT NOT NULL,
  province TEXT,
  raw_response TEXT NOT NULL,       -- full Represent API response, for debugging/reprocessing
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS politicians (
  slug TEXT PRIMARY KEY,            -- Open Parliament politician slug
  name TEXT NOT NULL,
  party TEXT,
  riding_name TEXT,
  photo_url TEXT,
  raw_detail TEXT NOT NULL,         -- full Open Parliament politician detail response
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS politician_votes (
  politician_slug TEXT PRIMARY KEY,
  raw_votes TEXT NOT NULL,          -- full Open Parliament ballots-list response
  fetched_at TEXT NOT NULL
);

-- A recorded vote's facts (date, bill, description) never change once
-- cast, so this cache has no TTL - once a vote_url is cached, it's
-- considered fresh forever. Separate from politician_votes because a
-- single vote is shared across every MP who cast a ballot on it.
CREATE TABLE IF NOT EXISTS vote_details (
  vote_url TEXT PRIMARY KEY,
  raw_detail TEXT NOT NULL,         -- full Open Parliament vote-detail response
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wikidata_profiles (
  politician_slug TEXT PRIMARY KEY,
  wikidata_id TEXT,
  raw_entity TEXT,                  -- full wbgetentities response; NULL if no confident match found
  fetched_at TEXT NOT NULL
);

-- Reference data, not a per-request cache: current base/add-on salary
-- figures. Seeded once, updated by `npm run refresh:salary`.
-- `verified` = 0 means the figure has not been confirmed against a live
-- fetch of the primary source in this environment and should not be
-- presented as confirmed fact (see lib/sources/salary.ts).
CREATE TABLE IF NOT EXISTS salary_rates (
  role_key TEXT PRIMARY KEY,        -- 'base', 'cabinet_minister', 'parliamentary_secretary', ...
  label TEXT NOT NULL,
  amount_cad INTEGER NOT NULL,
  effective_date TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  updated_at TEXT NOT NULL
);
