# TenderLens — Development Status

Last updated: 2026-10-17

## Current stage
Feature 1 (project foundation) implemented and verified **in a sandbox repository** (branch `feature/project-foundation`). It has NOT yet been merged into, or tested within, the team's real GitHub repository. See the transfer steps in `README.md`.

## Decisions currently agreed
- Product: project procurement, document intelligence, evidence-backed price benchmarking and expense reconciliation.
- Initial target: construction/renovation projects, with a narrow first category set.
- Proposed stack for a new project: React + Vite, Node.js + Express, PostgreSQL, Python document service, Python pricing service.
- Project documents are generated from structured, provided/reviewed details. Missing values must remain missing or be clearly marked.
- OCR results are reviewed and corrected by a human when needed.
- Canonical item matching is separate from physical-object computer vision.
- Start pricing with a transparent baseline; train/refresh ML only when data and validation support it.
- Private project data is private by default.
- Four-person team with module ownership and integration-first Git workflow.

## Completed
- [ ] Private repository created
- [x] Starter docs committed (sandbox repo only)
- [ ] Shared architecture and API contract reviewed
- [x] Project foundation implemented (sandbox; pending lead review/merge into the real repo)
- [x] Project foundation tests/build verified in sandbox (see below; Docker Compose path unverified)
- [ ] BOQ/document feature integrated
- [ ] OCR feature integrated
- [ ] Pricing service integrated
- [ ] Quotation comparison integrated
- [ ] Milestone and reconciliation features integrated
- [ ] End-to-end demo verified

## Current feature
Feature 1: Project Creation & Management Foundation — implemented in sandbox, awaiting integration.

### Feature 1 verification (actually run, 2026-10-17, sandbox)
| Check | Result |
|---|---|
| Backend `tsc` typecheck + build | passed |
| Backend tests (`vitest`, real PostgreSQL 16.15, 2 files) | 58 passed, 0 failed |
| Frontend `tsc --noEmit` + `vite build` | passed (JS bundle ~716 kB / 213 kB gzip; Vite warns about chunk size) |
| Frontend tests (`vitest` + jsdom, 2 files) | 30 passed, 0 failed (3 consecutive full runs) |
| Migration applied twice to a real PostgreSQL DB | applied once, second run a no-op |
| Live stack smoke test (API + Vite proxy + seeded demo data) | list/filter/sort, dashboard summary, idempotent create (201 then 200), DB-down 503 all behaved as designed |
| Visual check in headless Chromium (desktop 1360px, mobile 390px) | dashboard, projects list, create-form validation, detail page and mobile layout inspected; two real CSS bugs found and fixed |
| OpenAPI file parses as YAML | yes (not validated against an OpenAPI linter) |

### Not verified / limitations
- `docker-compose.yml` was never run (Docker was unavailable); tests ran on native PostgreSQL 16 installed via apt.
- No authentication, authorization, audit trail or rate limiting. Development only; no real or confidential data.
- Concurrent edits are last-write-wins.
- Not tested: real-browser form submission end-to-end (create/edit) — the create/edit/list flows are covered by jsdom component tests with mocked `fetch` plus separate API tests against PostgreSQL, but no browser-driven test connects the two; Safari/Firefox; screen-reader behaviour; keyboard navigation was designed (focus styles, labels, ARIA) but not audited; colour contrast not measured with a tool.
- No ESLint/Prettier configured (none existed). No CI.
- Status transitions, project types and currencies are proposals awaiting lead confirmation.
- Search uses `ILIKE '%…%'` (sequential scan); fine for small data, add trigram indexes if lists grow large.
- Dashboard "planned budget" excludes cancelled projects and never mixes currencies (design choice, documented).

## Known issues / decisions pending
- Exact authentication provider and user/organization model (Feature 1 ships with none; `projects.organization_id` is reserved).
- Feature 1 schemas/contracts (see INTEGRATION_CONTRACTS.md) must be confirmed by the lead against the actual repository.
- Market-data sources and initial benchmark category need to be selected before claiming real predictive capability.
- Deployment target and object storage provider are not yet fixed.

## Update instructions
After each feature, update this file with completed feature and commit/PR reference; actual tests/builds and results; API/schema changes; known bugs and limitations; next dependency and owner.

## Next dependency and owner
- Project lead: review Feature 1 contract proposals; transfer the branch into the real repo; confirm statuses/types/currencies/migration tool.
- Next feature (BOQ/documents) depends on `projects.id` and the contract conventions above.
