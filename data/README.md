# /data

Data ingestion pipeline code and per-source importers.

Implements [`PROJECT.md`](../PROJECT.md) §10 (Data sources) and §11 (Data ingestion architecture): one importer per source, running Source → Raw data → Normalization → Entity matching → Validation → Database.

Starts empty. Phase 2 (§27) adds the first importers (Elections Canada, Parliament of Canada) against the core Phase 1–2 schema in `/database`.
