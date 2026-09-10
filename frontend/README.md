# frontend

Next.js + TypeScript app implementing [`PROJECT.md`](../PROJECT.md) — currently just the first concrete slice, scoped tighter than the full spec:

**What's here:** postal code → federal riding → sitting MP → profile page (voting record, salary, career/bio, social links), with a SQLite cache so lookups aren't re-fetched on every request.

**What's not here yet:** accounts, comments/discussion, polls, moderation, admin UI, any entity type other than Politicians, provincial/municipal data. See `PROJECT.md` for the full roadmap — this app will grow into that structure, not be rebuilt for it.

For this slice, API routes live in this app (`app/api/`) rather than a separate `/api` service — simplest thing that works for one data flow. Revisit the split if/when background jobs or a second consumer actually need their own service.

## Data sources

| Source | Used for |
|---|---|
| [Represent API](https://represent.opennorth.ca/api/) (Open North) | Postal code → federal electoral district |
| [Open Parliament API](https://api.openparliament.ca/) | Riding → sitting MP, voting record |
| [Wikidata](https://www.wikidata.org/) | Career background, Wikipedia link, social media links |
| ourcommons.ca / [ParlInfo](https://lop.parl.ca/sites/ParlInfo/default/en_CA/People/Salaries) | Sessional indemnity + role add-on salary figures |

All three live APIs are unauthenticated and public. See `lib/sources/` for one module per source.

**Network note:** this app's own outbound calls to these APIs were built and reasoned about carefully, but could not be tested live against real responses from inside the sandbox this was built in (organization network policy blocks it — confirmed, not assumed). Run it somewhere with normal internet access to see the live flow; see the root of this README's linked PR/commit notes for exactly what was and wasn't verified.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite cache file is created automatically at `.data/app.db` on first run (gitignored).

## Scripts

- `npm run dev` / `npm run build` / `npm run start` — standard Next.js
- `npm test` — fixture-based unit tests (see `## Testing` below)
- `npm run refresh:salary` — re-fetches current sessional indemnity / role add-on figures and updates the `salary_rates` cache table (see `lib/sources/salary.ts` for what's verified vs. placeholder)

## Testing

Live network access to the external APIs was not available while building this, so correctness is checked two ways:

1. `npm test` — unit tests against hand-built fixtures (`fixtures/`) that mirror each API's documented/observed shape, for the parsing and matching logic (postal code validation, riding-name matching, response parsing, salary computation).
2. `npm run build` / `next dev` — confirms the app compiles and the postal-code form renders; does **not** confirm the live API calls succeed end to end.

Before relying on this in production, run it once with real network access and compare actual API responses to the shapes assumed in `lib/sources/*.ts` (each file has comments marking which fields are confirmed vs. best-effort).
