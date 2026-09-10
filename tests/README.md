# /tests

Cross-cutting test suites: end-to-end user journeys and data-integrity checks that span `/api`, `/frontend`, and `/data`.

Implements [`PROJECT.md`](../PROJECT.md) §24 (Testing requirements) — in particular the automated check that no Claim exists without an attached Source (§12), and e2e coverage of the user journeys in §6.

Unit tests for a single package (e.g. one importer in `/data`, one API module) live alongside that code, not here — this directory is for suites that cross package boundaries.
