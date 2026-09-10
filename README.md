# politics

A civic/political information and participation platform: a single place to understand political issues, investigate elected officials and organizations, see the evidence behind every claim, and participate.

**Start here:** [`PROJECT.md`](./PROJECT.md) is the product and engineering specification — the single source of truth for what this is and how it's built. Every directory below implements a section of it; nothing should be built that isn't traceable back to that document.

```
/database    Migrations, seed data, ERD docs
/api         Backend service
/frontend    Public-facing application
/design      Design system source files, tokens, mockups
/docs        Supporting docs expanding on PROJECT.md sections
/data        Data ingestion pipeline and per-source importers
/tests       Cross-cutting test suites (e2e, data-integrity)
```

Status: pre-Phase-1. See `PROJECT.md` §27 (Roadmap) and §1/§10/§16 for open product/legal decisions that need sign-off before implementation starts.
