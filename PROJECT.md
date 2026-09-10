# PROJECT.md — Civic/Political Information & Participation Platform

**Status:** Draft v0.1 — product & engineering specification for handoff to a coding AI / dev team.
**Working title:** not yet named (referred to below as "the Platform"). Pick a name before Phase 1 ships publicly.

This document is the single source of truth for what is being built. Downstream artifacts (data model, API, schema, UI) are *derived* from it, in that order. A coding AI implementing this project should treat this file as binding: where it is silent, stop and raise a question rather than inventing product behavior — see §29.

## How to read this document

- Sections marked **OPEN DECISION** are things the product owner has not yet decided. Do not resolve these unilaterally; surface them.
- Sections marked **ASSUMPTION** are inferred from context (mainly: the initial jurisdiction is Canada, given the references to Elections Canada, federal/provincial/municipal government, and Quebec privacy law). Confirm or correct these before they harden into architecture.
- Everything else is a working decision, good enough to build against until revised.

---

## Table of contents

1. [Product vision](#1-product-vision)
2. [Product principles](#2-product-principles)
3. [Target users](#3-target-users)
4. [User permissions](#4-user-permissions)
5. [Functional requirements](#5-functional-requirements)
6. [User journeys](#6-user-journeys)
7. [Feature specifications](#7-feature-specifications)
8. [Data model](#8-data-model)
9. [Entity relationships](#9-entity-relationships)
10. [Data sources](#10-data-sources)
11. [Data ingestion architecture](#11-data-ingestion-architecture)
12. [Source/evidence system](#12-sourceevidence-system)
13. [Search system](#13-search-system)
14. [AI requirements](#14-ai-requirements)
15. [Moderation system](#15-moderation-system)
16. [Security/privacy requirements](#16-securityprivacy-requirements)
17. [API specification](#17-api-specification)
18. [Database schema](#18-database-schema)
19. [Frontend architecture](#19-frontend-architecture)
20. [UI/UX specification](#20-uiux-specification)
21. [Design system](#21-design-system)
22. [Admin system](#22-admin-system)
23. [Infrastructure](#23-infrastructure)
24. [Testing requirements](#24-testing-requirements)
25. [Deployment](#25-deployment)
26. [Analytics](#26-analytics)
27. [Roadmap](#27-roadmap)
28. [Definition of Done](#28-definition-of-done)
29. [Development rules for the coding AI](#29-development-rules-for-the-coding-ai)
30. [Known future features](#30-known-future-features)

---

## 1. Product vision

**Working concept:** a civic/political information and participation platform.

**Core problem:** political information is fragmented, hard to understand, and disconnected from the people and organizations exercising power. Voting records live in one place, financial disclosures in another, lobbying registries in a third, news coverage is partisan or paywalled, and almost nothing connects them.

**Core promise:** give users a single place to understand political issues, investigate elected officials and organizations, see the evidence behind every claim, and participate — without the platform itself becoming another partisan actor.

**What makes this different from a news site or a wiki:**
- Every factual statement traces to a source (§12) — this is a structural property of the database, not an editorial policy.
- Entities (politicians, companies, organizations, bills, donations) are modeled as a connected graph, not isolated articles (§8–9), so relationships ("who funds whom," "who voted how") are queryable, not just narratively described.
- The system is explicit about the difference between fact, claim, opinion, and allegation (§2, §12), in the schema and in the UI, not just in prose.

**ASSUMPTION:** initial jurisdiction is Canada (federal government first), based on the data sources and privacy regimes referenced when this spec was scoped. The data model is designed to generalize to other jurisdictions (provincial, municipal, other countries) later, but Phase 1–4 content is Canada-federal-specific. Confirm before building ingestion pipelines in §10–11.

**OPEN DECISION:** product name/brand, monetization (if any), and whether this launches as a public nonprofit-style project, a company, or something else. This affects tone, data-source licensing negotiations, and legal structure for handling defamation risk (§16).

---

## 2. Product principles

These are constraints on every feature below, not aspirations.

1. **Traceability over authority.** The Platform never asserts a fact on its own authority. It shows what a source says, when, and how confident that makes the claim. See the epistemic model in §12.
2. **Separate fact from characterization.** "Politician X voted for Bill C-123" is a fact with a primary-source record. "Politician X is anti-housing" is an interpretation. The system must never blur these — in schema, API, or UI.
3. **Neutrality is structural, not tonal.** Neutrality isn't achieved by writing blandly; it's achieved by presenting all sourced positions on an issue side-by-side and letting users see the evidence, including for positions the platform's own operators disagree with.
4. **No silent edits to source data.** Corrections create new versioned records with an audit trail (§16, §22); they never overwrite history.
5. **Every claim about a real person is a legal and reputational liability if wrong.** Defamation risk is a first-class design concern, not an afterthought — see §12 and §16.
6. **Data quality over data quantity.** A smaller, well-sourced, well-matched dataset beats a large one full of duplicate/misattributed entities. Entity resolution (§11) is treated as core engineering, not cleanup.
7. **Bilingual by default.** Given the Canadian scope (ASSUMPTION, §1), English/French are both first-class from Phase 1, not a later localization pass — this affects content modeling (§8), not just UI strings.
8. **AI assists, it doesn't originate.** AI features (§14) operate only on data already in the system with sources attached. They summarize, explain, and help navigate; they do not generate new factual claims.

---

## 3. Target users

| Tier | Description |
|---|---|
| **Public (anonymous) user** | Anyone visiting the site, no account. |
| **Registered user** | Created an account; opts into participation features. |
| **Moderator** | Trusted role, reviews community-generated content and reports. |
| **Administrator** | Manages entities, datasets, sources, users, and configuration. |
| **Researcher/journalist** *(future, §30)* | Specialized data-export and query tooling. |
| **Organization** *(future, §30)* | Verified profile management for unions, NGOs, companies, advocacy groups. |

### Public user — can

- Browse political issues
- Search politicians, organizations, companies, bills
- Read policy explainers
- View voting records
- View financial/conflict-of-interest information
- Follow issues (read-only browsing of aggregated follower-driven surfacing — see note below on whether following requires an account)
- Save information (**OPEN DECISION:** does "save" require an account, i.e. is this actually a registered-user capability that was listed under public by mistake? Default assumption: saving/following require an account; anonymous users can browse and search only.)
- Participate in discussions/polls as **read-only** (viewing, not posting — posting requires an account, see §15)

### Registered user — everything above, plus

- Create a profile
- Follow politicians/issues
- Vote in platform polls
- Comment
- Submit information (evidence submissions, feeding the correction/contribution pipeline, §12, §15)
- Report errors
- Create proposals

### Moderator — can

- Review reports
- Moderate comments
- Review user submissions
- Correct misinformation (via the versioned-correction flow, §12 — never a silent edit)
- Manage flagged content

### Administrator — can

- Manage users (including role changes, suspensions)
- Manage political entities (politicians, parties, organizations, etc.)
- Manage datasets (trigger imports, review ingestion runs)
- Manage sources
- Manage moderation (oversee moderator actions, escalations)
- Configure the application

---

## 4. User permissions

Permissions are role-based (RBAC), additive (each tier includes the one below it, except Moderator/Admin which are lateral trust roles, not content-consumption tiers). Enforced server-side on every mutating endpoint — the frontend hiding a button is a UX convenience, never the security boundary (§16).

| Capability | Public | Registered | Moderator | Admin |
|---|:---:|:---:|:---:|:---:|
| Browse/search/read entities | ✅ | ✅ | ✅ | ✅ |
| View sourced claims & evidence | ✅ | ✅ | ✅ | ✅ |
| Follow entities/issues | — | ✅ | ✅ | ✅ |
| Comment, vote in polls, create proposals | — | ✅ | ✅ | ✅ |
| Submit evidence / error reports | — | ✅ | ✅ | ✅ |
| Review & resolve reports | — | — | ✅ | ✅ |
| Edit/correct published entity data | — | — | ✅ (queued for review, see §22) | ✅ (direct, still versioned) |
| Manage users/roles | — | — | — | ✅ |
| Manage sources & datasets | — | — | — | ✅ |
| Trigger data imports | — | — | — | ✅ |
| Configure application settings | — | — | — | ✅ |

A moderator's corrections are versioned and logged the same as an admin's; the difference is a moderator's direct entity edits queue for a second review by default (configurable per entity type — e.g., typo fixes may auto-apply, allegation-level content should not). **OPEN DECISION:** exact auto-apply vs. queue rules per field/entity type — define during Phase 5 (§27) once the moderation volume is understood.

---

## 5. Functional requirements

Consolidated, testable requirements derived from §3–4 and §7. This is the checklist Phase acceptance (§28) is measured against.

- FR1: A user can search across politicians, parties, organizations, companies, bills, and issues from a single search bar and get correctly disambiguated results (§13).
- FR2: Every entity profile page renders only claims that have at least one attached Source record (§12); the system must be structurally incapable of rendering an unsourced factual claim about a real person or organization.
- FR3: Every claim displays its epistemic status (FACT/CLAIM/OPINION/ANALYSIS/ALLEGATION/DISPUTED/UNKNOWN, §12) visibly, not just in metadata.
- FR4: A registered user can submit a correction or new evidence against any claim; submissions enter the moderation queue (§15) and never modify published data directly.
- FR5: An anonymous user can complete the entire "browse → search → read entity → read issue → view sources" journey without an account.
- FR6: All user-facing content is available in English and French (ASSUMPTION §1); entity records store bilingual fields where applicable rather than relying on machine translation for core facts.
- FR7: Voting records, financial disclosures, and bills are attributable to their government source with retrieval date and are re-importable/refreshable without creating duplicate entities (idempotent ingestion, §11).
- FR8: Admins can deactivate/correct any entity without deleting its history (§16 audit trail).
- FR9: AI-generated answers (§14) are traceable to the Source records used to produce them; the system rejects/flags AI output that cites no sources.
- FR10: Rate limiting and abuse protections apply to all write endpoints (comments, submissions, reports) before Phase 5 ships publicly (§16).

---

## 6. User journeys

Concrete flows used to validate the spec and drive early testing (§24).

1. **Understand a politician.** Anonymous user searches "Pierre Poilievre" → politician profile → sees party, riding, voting record, bills sponsored, donations, financial disclosures, each with source links → clicks a claim → sees the underlying source document.
2. **Understand an issue.** User browses to "Housing" issue page → sees the problem statement, key stats, current law, proposed legislation, party/politician positions side by side, organizations/companies involved → follows the issue (requires account → registration prompt).
3. **Investigate a relationship.** User on a company profile ("Airbnb") → sees donations made, lobbying activity, connected politicians → opens the relationship explorer → traces company → donation → politician → vote → bill chain visually (§7, §9).
4. **Contribute a correction.** Registered user notices a stale voting record → clicks "report error" on the claim → submits evidence (a link to the official record) → submission enters moderation queue → moderator reviews, approves → correction is published as a new version, old version remains in history.
5. **Ask a natural-language question.** Registered user asks "which MPs voted against Bill C-XX?" → AI (§14) translates this into a structured query against the Vote/Bill data → returns a list with links to each MP's profile and the underlying vote record, not a generated summary standing alone.
6. **Moderate.** Moderator opens queue → sees a reported comment and a submitted correction → resolves each per §15 state machine → actions are logged (§16).
7. **Admin data refresh.** Admin triggers a re-import from Elections Canada's candidate dataset → ingestion pipeline (§11) runs, flags 3 potential duplicate entities for manual entity resolution → admin resolves → dataset marked fresh with a visible "last updated" timestamp on affected entities.

---

## 7. Feature specifications

### 7.1 Political entity profiles

A politician's page includes (each field individually sourced per §12):

- Name, photograph, party, position, riding/district
- Biography, current mandate, previous mandates
- Voting record
- Parliamentary activity, bills sponsored
- Public statements
- Political donations received
- Financial disclosures, declared interests
- Lobbying interactions
- Known organizations/companies connected to them
- Sources (visible list, not just inline footnotes)

The same pattern (structured fields + per-field sourcing) applies to Organization, Company, and Party profiles, with fields adjusted per entity type (§8).

### 7.2 Issue pages

```
Housing
│
├── What is the problem?
├── Key statistics
├── Current laws
├── Proposed legislation
├── Political parties' positions
├── Politicians' positions
├── Organizations involved
├── Companies involved
├── Lobbying activity
├── Public spending
├── Research
├── Arguments for different approaches
└── Sources
```

Issue pages are curated (admin/moderator-assembled from sourced entities), not auto-generated from raw data — an issue page is itself an entity that references other entities, not a template that queries them blindly. **OPEN DECISION:** initial issue taxonomy (which issues launch in Phase 4, §27) and who authors the "what is the problem" framing text, given principle #3 (structural neutrality) — this is the highest editorial-risk content type on the platform and needs an explicit authoring/review process, not just the general moderation flow.

### 7.3 Relationship explorer

Interactive graph visualization letting a user click an entity and traverse its relationships:

```
                    Company A
                       │
                    donation
                       ↓
Politician ←──── Party ────→ Organization
    │
    │
   voted
    ↓
   Bill
    │
    ↓
   Law
```

Phase 7 feature (§27); depends on the relationship data existing and being clean, which depends on Phases 2–3. Rendering approach and query pattern are decided in §9/§18 (relational tables first, dedicated graph DB only if relational modeling proves insufficient — matches principle of not introducing infrastructure prematurely, §23).

### 7.4 Search

See §13.

### 7.5 User-generated content

Comments, proposals, polls, evidence submissions, corrections, reports — see §15 for the moderation lifecycle each goes through.

### 7.6 AI features

See §14.

---

## 8. Data model

Core entities. Each is a first-class database table (§18), not a loose document blob — this is what makes the relationship explorer (§7.3) and structured search (§13) possible.

| Entity | Purpose | Key attributes (illustrative, not exhaustive) |
|---|---|---|
| **User** | Platform account | email, display name, role, locale, created_at |
| **Politician** | Elected or candidate individual | name, DOB, bio, current party, current riding, photo, status (active/former) |
| **PoliticalParty** | Party organization | name, abbreviation, ideology tags, founded date, leader (→ Politician) |
| **ElectoralDistrict** | Riding/constituency | name, jurisdiction level (federal/provincial/municipal), boundaries (geo, optional Phase 1) |
| **Election** | A specific election event | date, jurisdiction, type |
| **PoliticalCampaign** | A politician's run in an election | election → Politician, riding, result |
| **Government** | A sitting government | jurisdiction, term start/end, governing party |
| **GovernmentInstitution** | Ministry/department/agency | name, jurisdiction, mandate |
| **Bill** | Legislative bill | number, title, session, status, sponsor → Politician |
| **Law** | Enacted legislation | bill → Law linkage, enactment date |
| **Vote** | A recorded vote on a bill | bill, politician, position (yea/nay/abstain/absent), date |
| **Policy** | A stated policy position | owner (Party or Politician), issue, description |
| **Issue** | A topical area (e.g. Housing) | name, summary, curated content blocks (§7.2) |
| **Company** | For-profit entity | name, sector, registration info (where legally accessible) |
| **Organization** | Non-profit/union/NGO/advocacy body | name, type, sector |
| **Person** | Non-politician individual (donor, lobbyist, executive) | name, roles/affiliations |
| **Donation** | Political contribution | donor (Person/Company/Organization), recipient (Politician/Party), amount, date |
| **FinancialDisclosure** | Declared financial interest filing | discloser → Politician, filing date, document link |
| **Property** *(subtype of Asset)* | Disclosed real property | owner, location, value (if disclosed) |
| **LobbyingActivity** | Registered lobbying interaction | lobbyist/org, target (Politician/Institution), subject, date |
| **Relationship** | Generic typed edge between two entities not covered by a dedicated table | subject, predicate, object, source |
| **Source** | A citable origin of a claim | title, publisher, URL/document ref, type (primary/secondary), retrieved_at |
| **Document** | A specific document (disclosure PDF, Hansard transcript, etc.) | source → Source, storage ref, pages/sections |
| **Claim** | An atomic factual/interpretive statement | subject entity, predicate, object/value, epistemic status (§12), source(s) |
| **Event** | A dated occurrence (statement made, scandal, resignation) | date, description, related entities |
| **Comment** | User discussion post | author → User, target entity, body, moderation status |
| **Proposal** | User-submitted policy proposal | author, title, body, status |
| **Poll** | Platform poll | question, options, status |
| **Petition** | User-initiated petition | title, body, signature count, status |

**OPEN DECISION:** `Asset`/`Property` — the user note lists "Property" as a top-level entity but also "owns/has interest in → Asset" in the relationship sketch (§9). Treat `Property` as one subtype of a broader `Asset` entity (which could later include e.g. corporate holdings, trusts) — confirm this generalization is wanted before Phase 2 schema work, or keep `Property` as the only asset type for Phase 1 and generalize later.

Full column-level DDL is a Phase 1/2 implementation task (§18 gives a starting logical schema for the Phase 1–2 subset only — not all 30 entities need to exist on day one, see §27).

---

## 9. Entity relationships

```
Politician
    ├── belongs to        → PoliticalParty
    ├── represents         → ElectoralDistrict
    ├── participated in    → Election (via PoliticalCampaign)
    ├── voted on           → Bill (via Vote)
    ├── received           → Donation
    ├── disclosed          → FinancialDisclosure
    ├── owns/has interest in → Asset (Property, ...)
    ├── met/lobbied by     → Organization / Company (via LobbyingActivity)
    └── makes              → Event (public statement)

Bill
    ├── sponsored by       → Politician
    ├── voted on by        → Politician (via Vote)
    ├── relates to         → Issue
    └── enacted as         → Law

Company / Organization
    ├── donates to         → Politician / PoliticalParty (via Donation)
    ├── lobbies            → Politician / GovernmentInstitution (via LobbyingActivity)
    └── involved in        → Issue

Claim (the connective tissue)
    ├── about              → any entity above
    └── sourced by         → Source (→ Document)
```

Every edge above is itself sourced (§12) — a `Donation` or `LobbyingActivity` record without a `Source` is invalid data, not just incomplete data (enforce at the schema/validation layer, §11).

**Storage decision:** PostgreSQL with relational tables + explicit join tables per relationship type (Vote, Donation, LobbyingActivity, etc.), plus a generic `Relationship` table for long-tail edges that don't warrant a dedicated table yet. Do not introduce a dedicated graph database for Phase 1–6; revisit only if query patterns in the relationship explorer (§7.3, Phase 7) prove relational modeling insufficient (§23).

---

## 10. Data sources

**ASSUMPTION:** Canada-federal first (§1). Categories to integrate, roughly in priority order for Phase 2:

| Source | Provides |
|---|---|
| Elections Canada | Candidates, election results, riding boundaries, party financial returns |
| Parliament of Canada / House of Commons / Senate | Bills, votes, Hansard (statements), committee activity |
| Open Government (open.canada.ca) | Datasets, spending, government institution directories |
| Federal Lobbying Registry (OCL) | Registered lobbying activity |
| Provincial governments | Provincial legislature equivalents (Phase 2+, per-province rollout — **OPEN DECISION:** which provinces first; Quebec's Assemblée nationale + Registre des lobbyistes is a natural early candidate given the bilingual/Quebec context) |
| Municipal governments | Municipal council records (later phase, high fragmentation across municipalities) |
| Political party financial disclosures | Party-level and candidate-level filings |
| Statistics Canada | Key statistics for issue pages (§7.2) |
| Corporate registries (federal + provincial, where legally accessible) | Company registration, directors |

Each source needs, before ingestion work starts: access method (API vs. bulk download vs. scrape — scraping only where ToS/robots permit), update cadence, licensing terms, and a named legal/primary-source citation format. **OPEN DECISION:** formal legal review of scraping/ToS for any source without a public API or open-data license, before Phase 2 ingestion is built against it.

---

## 11. Data ingestion architecture

```
Source
  ↓
Importer          (source-specific adapter; scheduled or triggered)
  ↓
Raw data          (stored as-received, immutable, for audit/replay)
  ↓
Normalization     (schema mapping, unit/format cleanup)
  ↓
Entity matching   (resolve to existing entity or flag as new/possible-duplicate)
  ↓
Validation        (required fields present, source attached, sanity checks)
  ↓
Database          (published, versioned)
  ↓
Application
```

- **Idempotency:** re-running an importer against unchanged source data must not create duplicate entities or claims (FR7, §5).
- **Entity matching** is the highest-risk step (misattributing a donation to the wrong "John Smith" is a defamation incident, not a bug) — matches below a confidence threshold are queued for admin resolution (§22), never auto-published.
- **Raw data retention:** keep the as-ingested payload indexed by retrieval date, so a claim can always be traced back to exactly what the source said at import time, independent of later source-side edits.
- Each importer run produces a report (rows processed, new entities, flagged duplicates, validation failures) visible in the admin dataset dashboard (§22).

---

## 12. Source/evidence system

This is the platform's core technical differentiator. A factual statement is never stored as a bare string; it's stored as a **Claim** with attached evidence:

```
Claim:       Politician X owns property Y.
Source:      Official financial disclosure
Source date: 2026-04-17
Retrieved:   2026-05-01
Evidence:    Document/page/section
Confidence:  High
Status:      Verified
```

### Epistemic status (required field on every Claim)

| Status | Meaning |
|---|---|
| **FACT** | Directly verifiable from a primary source (e.g., an official vote record) |
| **CLAIM** | A stated assertion, not yet independently verified |
| **OPINION** | A subjective position, attributed to its holder, not presented as true/false |
| **ANALYSIS** | A derived conclusion (platform's or a cited analyst's), clearly attributed as analysis |
| **ALLEGATION** | An accusation not yet established as fact — highest defamation risk, see §16 |
| **DISPUTED** | Conflicting sources exist; both/all sides shown |
| **UNKNOWN** | Explicitly flagged as unresolved rather than omitted, so users know the platform looked and couldn't confirm |

The UI must render this status visibly on every claim (FR3, §5) — not as a tooltip a user has to discover, but as a persistent visual marker (§21 design system defines the color/iconography).

This system distinguishes **what happened** from **what someone says happened** from **what the evidence suggests** from **what the platform/a user concludes** — directly operationalizing principle #2 and #3 (§2).

Corrections never overwrite a Claim in place; they create a new version and preserve the prior one with its own status (e.g., superseded), so the platform can show "this was previously stated as X, corrected to Y on [date], see [correction source]" (§16 audit trail).

---

## 13. Search system

Entity-typed search, disambiguated by result type:

```
"Pierre Poilievre"  → Politician
"Airbnb"             → Company
"Housing"            → Issue
"C-XXX"               → Bill
"who donated to..."  → Relationship query
```

- Phase 3 (§27): typed full-text search across all entities, PostgreSQL `tsvector`/trigram-based initially (§23) — no dedicated search infrastructure until query volume or relevance needs justify it (matches §2 principle of not over-building ahead of need).
- Relationship queries ("who donated to X," "which MPs voted against bill Y") are structured queries against the relational schema (§18), exposed through defined API query parameters (§17) and later through the AI natural-language layer (§14) — the AI does not have its own separate query capability; it composes the same structured queries the API exposes.
- Migration path to Elasticsearch/OpenSearch is available if Postgres search becomes a bottleneck; do not adopt it preemptively.

---

## 14. AI requirements

### AI can

- Summarize legislation
- Explain complex political terminology
- Answer questions using verified application data
- Find relationships in the database
- Compare policy positions
- Help users navigate information
- Identify potentially duplicate entities (flagged for admin review, §11/§22 — never auto-merged)
- Flag contradictory information (surfaces as DISPUTED status candidates, §12 — never auto-resolves)

### AI cannot, under any circumstance

- Invent political facts
- Present speculation as fact
- Silently alter source data
- Determine that an allegation is true (epistemic status changes on Claims are a human moderation/admin action, §12, §15)
- Fabricate citations
- Make political persuasion decisions on behalf of users

**Grounding requirement:** every AI-generated factual answer must be grounded in application data and cite the specific Source/Claim records it drew from (FR9, §5). An AI response that cannot cite a source for a factual assertion must say so explicitly rather than answering. This is enforced at the application layer (the AI's data access is scoped to a retrieval function over Claims/Sources, not free generation) — not just a prompt instruction.

Phase 6 feature (§27); depends on Phases 2–4 producing enough clean, sourced data to ground answers in.

---

## 15. Moderation system

### Content states

```
Submitted → Pending review → Approved → Published
```

```
Published → Reported → Under review → Corrected / Removed / Reinstated
```

- **Comments/proposals/polls:** lightweight moderation, community reports trigger queue entry, moderators action per community-content guidelines (**OPEN DECISION:** draft explicit community guidelines before Phase 5 launch).
- **Evidence submissions/corrections against entity data:** always queued (never auto-published, regardless of submitter trust level) given the defamation/accuracy stakes (§16) — a moderator or admin must approve before a Claim's status or content changes.
- All moderation actions are logged with actor, timestamp, before/after state (§16 audit trail) — required for both legal defensibility and internal QA.
- Escalation path: moderator → admin for legally sensitive content (allegations about real people, anything a moderator is unsure about) — moderators should have a clear "escalate, don't decide" option for ALLEGATION-status content.

---

## 16. Security/privacy requirements

- **Authentication:** email + password (properly hashed, Argon2id or bcrypt, never reversible encryption) and OAuth providers (**OPEN DECISION:** which providers — Google at minimum is a reasonable default).
- **Authorization:** RBAC per §4, enforced server-side on every mutating and every sensitive-read endpoint; frontend role checks are UX only.
- **Encryption:** TLS in transit everywhere; encryption at rest for the database and object storage (§23).
- **API security:** input validation on every endpoint, parameterized queries only (no raw SQL interpolation — SQLi), output encoding (XSS), CSRF protection on cookie-authenticated mutating requests, rate limiting per user/IP on all write endpoints and on search (FR10, §5).
- **Audit logs:** immutable log of all admin/moderator actions and all entity-data changes (who, what, when, before/after) — not just for security incident response, but because this platform will face accusations of bias and needs to show its work.
- **Admin permissions:** tiered within Admin if needed (e.g., "can edit entities" vs. "can manage users/roles") — **OPEN DECISION:** whether a single Administrator tier is sufficient for Phase 1–5 or this needs sub-roles sooner.
- **User data deletion:** registered users can request account deletion; personal account data is deleted/anonymized, but a user's public contributions that became part of the sourced record (e.g., an approved correction) are retained with the account reference anonymized, not deleted, to preserve the evidence trail (§12) — **OPEN DECISION:** confirm this resolution of "right to erasure vs. evidentiary integrity" is acceptable; it should be, but needs explicit sign-off given legal sensitivity.
- **Data retention & backups:** define retention windows per data type; automated encrypted backups with tested restore procedure before any production launch.
- **Abuse prevention:** rate limits, CAPTCHA on registration/high-risk actions, report/appeal flow (§15).
- **Privacy regime:** PIPEDA (Canada) at minimum; Quebec's Law 25 if operating in/targeting Quebec residents (ASSUMPTION, §1) — includes privacy-by-design and privacy-impact-assessment obligations for a platform processing what could be considered data revealing political opinions (see next point). **OPEN DECISION:** formal legal review of applicable privacy regimes before Phase 5 (user accounts) ships.
- **User activity itself is sensitive data.** A user's browsing/follow/search history on a political platform can reveal their political opinions — treat this as a special category internally: minimize collection, aggregate for analytics (§26) rather than retaining individual political-interest profiles longer than needed for the feature (e.g., "followed issues" needed for notifications) to function.
- **Defamation risk management:** every ALLEGATION-status claim about a real person should go through a stricter publication bar than a FACT-status claim (§12, §15) — **OPEN DECISION:** whether this requires legal review before publication, or a purely editorial/moderation bar suffices; recommend involving legal counsel before Phase 4 (issue pages, which will surface allegation-adjacent content) ships publicly.

---

## 17. API specification

- **Style:** REST, resource-oriented, versioned base path `/api/v1/`. Resources map to §8 entities (`/politicians`, `/bills`, `/issues`, `/organizations`, `/claims`, etc.).
- **Pagination:** cursor-based on list endpoints (stable under concurrent writes, unlike offset pagination).
- **Filtering:** query params scoped per resource (e.g., `/votes?bill=C-123&politician=...`); relationship queries (§13) exposed as documented filter combinations, not ad-hoc query strings.
- **Auth:** Bearer token (session-derived) for registered-user actions; public GET endpoints unauthenticated.
- **Errors:** standard envelope `{ error: { code, message, details } }`, consistent HTTP status usage.
- **Rate limiting:** documented per-endpoint limits, returned via standard `Retry-After`/`X-RateLimit-*` headers.
- **Versioning:** breaking changes require a new version path; no silent breaking changes to `/v1`.
- GraphQL is a candidate for the relationship explorer (§7.3, Phase 7) where flexible nested queries matter more than REST's simplicity — do not adopt it for Phase 1–6; REST covers the CRUD + filtered-list needs of those phases.

---

## 18. Database schema

Illustrative **logical** schema for the Phase 1–2 subset only (§27) — full DDL (types, indexes, constraints) is implementation work, not a product-spec decision, but every table needs a `source_id`/`claim_id` linkage for any user-facing fact, per §12.

```
users(id, email, password_hash, display_name, role, locale, created_at)

politicians(id, full_name, dob, bio_en, bio_fr, party_id, riding_id, photo_url, status)
political_parties(id, name_en, name_fr, abbreviation, leader_politician_id)
electoral_districts(id, name_en, name_fr, jurisdiction_level)
elections(id, date, jurisdiction, type)
political_campaigns(id, election_id, politician_id, riding_id, result)

bills(id, number, title_en, title_fr, session, status, sponsor_politician_id)
votes(id, bill_id, politician_id, position, voted_at)

sources(id, title, publisher, url, source_type, retrieved_at)
documents(id, source_id, storage_ref, pages)
claims(id, subject_type, subject_id, predicate, object_value, epistemic_status,
       confidence, status, created_at, superseded_by_claim_id)
claim_sources(claim_id, source_id)            -- many-to-many

companies(id, name, sector, registration_ref)
organizations(id, name, org_type, sector)
people(id, full_name)                          -- non-politician individuals

donations(id, donor_type, donor_id, recipient_type, recipient_id, amount, donated_at, claim_id)
financial_disclosures(id, politician_id, filed_at, document_id)
lobbying_activities(id, lobbyist_ref, target_type, target_id, subject, occurred_at, claim_id)

comments(id, author_user_id, target_type, target_id, body, moderation_status, created_at)
reports(id, reporter_user_id, target_type, target_id, reason, status, created_at)
audit_log(id, actor_user_id, action, target_type, target_id, before, after, created_at)
```

`subject_type`/`target_type` + `subject_id`/`target_id` pairs are polymorphic references to any entity table — standard trade-off (flexibility vs. FK integrity); enforce validity at the application layer with tests (§24), since Postgres can't natively FK-constrain a polymorphic reference.

Remaining §8 entities (Government, GovernmentInstitution, Law, Policy, Issue, Property/Asset, Relationship, Event, Proposal, Poll, Petition) get equivalent tables added as their owning phase (§27) begins — do not create all 30 tables in Phase 1 against speculative future need.

---

## 19. Frontend architecture

- **Framework:** Next.js (React), server components for entity/issue pages — these need to be crawlable/indexable (SEO matters for a platform whose value is discoverability) and fast on first load.
- **Interactive surfaces** (relationship explorer §7.3, search-as-you-type, poll voting) as client components.
- **i18n:** English/French from Phase 1 (§2 principle #7) — content fields store both locales where the source material supports it (§18 `_en`/`_fr` column pattern); UI strings through a standard i18n library, not ad-hoc conditionals.
- **Data fetching:** server-rendered pages call the API (§17) server-side for initial render; client-side fetching for interactive/paginated sections.
- State management: kept minimal — server components + URL state (filters, search params) for most pages; a client state library only where the relationship explorer's interaction state genuinely needs it.

---

## 20. UI/UX specification

Pages required through Phase 5 (§27):

- Home
- Search results (typed: politicians / organizations / companies / bills / issues)
- Politician profile
- Organization/Company profile
- Issue page
- Bill page
- Relationship explorer (Phase 7)
- User profile/dashboard (followed issues, saved items, submissions)
- Discussion/comment threads
- Notifications
- Admin dashboard (§22)
- Auth flows (register, login, password reset, email verification)
- Error/empty states (no results, entity not found, data pending import)

Cross-cutting requirements: accessibility target **WCAG 2.1 AA** minimum (a civic-information platform has a heightened obligation to be usable by everyone); responsive/mobile layout for all public-facing pages; every entity page must render sensibly even when most fields are empty (early-phase data will be incomplete — the empty state is not an edge case here, it's a common case, §11).

---

## 21. Design system

- **Typography/color/spacing:** standard scale-based design tokens (**OPEN DECISION:** no visual design work has been done yet — this needs an actual design pass, not just a token list, before Phase 1 frontend work starts in earnest).
- **Epistemic status color coding** (§12): each status (FACT/CLAIM/OPINION/ANALYSIS/ALLEGATION/DISPUTED/UNKNOWN) needs a distinct, consistent visual treatment used everywhere a Claim renders — this is a core system component, not a one-off badge.
- **Component inventory:** entity card, claim block (with source citation + status badge), relationship-graph node/edge, comment thread, poll widget, admin data table, moderation queue item.
- Component library approach (build vs. adopt e.g. shadcn/ui as a base) — **OPEN DECISION**, reasonable default: adopt an existing accessible component library and theme it, rather than building primitives from scratch.

---

## 22. Admin system

The internal dashboard is treated as a first-class product surface, not an afterthought — for a data-heavy platform like this, it's arguably more load-bearing than any single public page.

Administrators can:

- Add/edit entities
- Import datasets (trigger + monitor importer runs, §11)
- Review sources
- Resolve duplicate people/entities (the entity-matching queue, §11)
- Correct information (versioned, §12)
- Approve submissions (§15 queue)
- Moderate users
- See automated errors (failed imports, validation failures)
- Manage claims (review DISPUTED/ALLEGATION-status items)
- See data freshness (last successful import per source, §10)
- Trigger data updates

Phase 2 needs a minimal version of this (entity CRUD + source management) to make ingestion (§11) usable at all; the full moderation-queue UI lands with Phase 5.

---

## 23. Infrastructure

Starting point, explicitly **not locked in** — per the top-level methodology, this should be revisited once §5–18 are stable enough that requirements (not habit) drive the choice.

```
Frontend        Next.js / React
Backend         TypeScript / Node.js
Database        PostgreSQL
Authentication  OAuth + email authentication
API             REST (see §17; GraphQL deferred)
Search          PostgreSQL initially → Elasticsearch/OpenSearch later if required
Object storage  S3-compatible storage (disclosure PDFs, document scans, §12 Document records)
Background jobs Queue + workers (import pipelines, §11)
AI              LLM API, scoped to data-grounded retrieval (§14)
Hosting         Cloud infrastructure (provider **OPEN DECISION**)
Monitoring      Application + database monitoring
```

TypeScript end-to-end (frontend + backend) keeps the entity/claim types shared between API and UI, which matters given how central the Claim/Source model (§12) is to correctness.

---

## 24. Testing requirements

- **Ingestion pipeline (§11):** unit tests per importer/normalizer; entity-matching tests using known duplicate/near-duplicate fixtures (this is the highest-risk code path — a bad match is a real-world misattribution, §11).
- **API (§17):** integration tests per endpoint, including permission-boundary tests (a Public-tier request must never be able to trigger a Registered/Moderator/Admin action, §4).
- **Data integrity:** automated checks that no Claim exists without an attached Source (§12 enforced structurally, verified by tests, not just by convention).
- **E2E:** the user journeys in §6, at minimum — search → entity → source; submit correction → moderation → publish; admin import → entity resolution.
- **Accessibility:** automated WCAG checks in CI (§20) plus periodic manual review.
- Tests are written alongside the code that needs them, per phase (§27/§29), not retrofitted after a phase is "done."

---

## 25. Deployment

- **Environments:** dev, staging, production.
- **CI/CD:** lint + typecheck + test (§24) required to pass before merge; staging deploy on merge to main; production deploy is a deliberate, reviewed step (not automatic) at least through Phase 5, given the legal/reputational sensitivity of this content.
- **Migrations:** schema changes ship as reviewed, reversible migrations; no direct production schema edits.
- **Rollback:** every production deploy must have a known rollback path (previous build + migration-down path) before Phase 1 infrastructure is considered done.

---

## 26. Analytics

- Track: search usage/success (did the user find what they searched for), most-viewed entities/issues, engagement (follows, comments, poll participation), data-quality signals (error reports per entity, import failure rates).
- **Privacy constraint (§16):** aggregate by default; do not build individual-user political-interest profiles beyond what a feature (e.g., notifications for followed issues) actually needs to function. Treat this as a hard constraint on analytics tooling choice, not just a policy — e.g., avoid third-party analytics vendors that would receive per-user political-browsing data.

---

## 27. Roadmap

| Phase | Scope |
|---|---|
| **1 — Foundation** | Repository, database, authentication, basic frontend, API skeleton, deployment, CI/CD |
| **2 — Political database** | Politicians, parties, ridings, elections, bills, votes, sources (§8–12, §18 core tables); minimal admin CRUD (§22) |
| **3 — Search/exploration** | Search (§13), filters, entity pages (§7.1) |
| **4 — Issues** | Issues, policies, explanations, comparisons (§7.2) |
| **5 — Community** | Accounts, comments, proposals, polls, reports (§4, §15) |
| **6 — AI** | AI search, summarization, question answering, evidence retrieval (§14) |
| **7 — Advanced investigation** | Relationship graphs, financial networks, lobbying networks, corporate relationships, advanced queries (§7.3) |

Each phase's acceptance criteria are defined in §28. Do not start a phase's distinctive feature work before the prior phase's Definition of Done is met (§29 dev rule) — e.g., no AI grounding (Phase 6) against a database that hasn't passed Phase 2/3 data-quality bars.

---

## 28. Definition of Done

**Per phase**, in addition to that phase's specific scope (§27):

- All FR items (§5) attributable to that phase pass.
- Test coverage per §24 for new code paths.
- No Claim/fact-bearing entity ships without a Source (§12) — enforced by the automated check in §24, not manual review alone.
- Accessibility check (§20) for any new public-facing page.
- Security review (§16) for any new auth, permission, or admin-surface code.
- Docs (this file + relevant `/docs` entries, see repo structure below) updated to reflect what was actually built, including any deviations raised as questions per §29 and resolved.

**Overall project "v1 done"** (end of Phase 5, before AI/advanced-investigation phases): an anonymous user can complete journeys 1–2 (§6) end to end on real, sourced Canadian federal political data, in English and French, and a registered user can complete journey 4 (contribute a correction) end to end through moderation.

---

## 29. Development rules for the coding AI

1. **Follow the phase order (§27).** Don't build Phase 6 AI features against Phase 2-incomplete data, don't build the relationship explorer before the underlying relationship data exists and is clean.
2. **Every factual claim about a real person or organization must link to ≥1 Source record before it can render.** If you're implementing a feature and there's no source data yet, render the explicit empty/pending state (§20) — never a placeholder that looks like real data.
3. **Never invent data.** If an imported dataset lacks a field, store it as null/unknown (§12 `UNKNOWN` status where relevant) — do not fill gaps with plausible-sounding guesses, including via AI generation.
4. **Preserve the FACT/CLAIM/OPINION/ANALYSIS/ALLEGATION/DISPUTED/UNKNOWN distinction (§12) everywhere** — in schema, API responses, and UI. Don't "simplify" it away in an implementation pass.
5. **No silent overwrites.** Corrections to published entity data create new versions (§12, §16 audit trail); don't implement edits as in-place UPDATEs on fact-bearing tables.
6. **This spec is binding where it speaks, and a question where it doesn't.** Where you hit an **OPEN DECISION** marker, or a product/legal choice this document doesn't cover, raise it rather than deciding unilaterally and moving on — especially anything touching defamation risk (§16), privacy (§16), or the epistemic model (§12).
7. **Don't introduce infrastructure ahead of need** (§23): no dedicated graph DB, no Elasticsearch, no GraphQL layer until the phase that needs it (§27) and until Postgres/REST is demonstrated insufficient, per the principle that requirements — not habit — should drive architecture.
8. **Small, incremental changes matching the phase/milestone structure.** Write tests alongside the code (§24), not after.
9. **Every AI-generated factual answer (§14) must cite the Source/Claim records it used**, enforced in code (scoped retrieval), not left to prompting alone.
10. **Real people are never hard-deleted.** Entities representing real people/organizations are status-flagged (e.g., deceased, no longer in office, merged-duplicate) and versioned, never removed from the database, to preserve auditability (§16).

---

## 30. Known future features

Explicitly out of scope for Phases 1–7 above, but the data model (§8) should not preclude them:

- **Researcher/journalist accounts** with specialized dataset export and query tooling.
- **Verified Organization accounts** for unions, NGOs, companies, and advocacy groups to manage/respond to their own profile (with clear provenance rules so this can't be used to launder a verified-looking but self-serving narrative — any self-submitted content still goes through §15 moderation and is labeled as organization-submitted).
- **Public API** for external researchers/journalists (rate-limited, likely a separate tier from §17's application API).
- Expansion beyond federal Canadian politics: **provincial and municipal jurisdictions**, then potentially other countries — the entity model's `jurisdiction_level` fields (§18) are there to make this additive rather than a rewrite.
- **Natural-language query interface** as a superset of §14's grounded Q&A — e.g., "show me politicians who received donations from companies involved in housing."
- Dedicated **graph database** if/when relational modeling (§9) demonstrably can't serve the relationship explorer's query patterns at scale.
- **Mobile apps** (native), beyond the responsive web app (§20).
- **Notification digests** (email/push) for followed issues/politicians.
- Multilingual expansion beyond English/French, if the platform expands beyond Canada.

---

## Repository structure

```
/database    Migrations, seed data, ERD docs — implements §18
/api         Backend service — implements §17
/frontend    Next.js app — implements §19–21
/design      Design system source files, tokens, mockups — implements §21
/docs        Supporting docs that expand on sections of this file as they're built out
/data        Ingestion pipeline code and per-source importers — implements §10–11
/tests       Cross-cutting test suites (e2e, data-integrity) — implements §24
```

Each directory has its own README pointing back to the relevant section(s) of this file. This file is the spec; the directories are where it gets implemented, starting at Phase 1 (§27).
