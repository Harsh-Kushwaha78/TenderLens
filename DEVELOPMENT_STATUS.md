# TenderLens — Development Status

Last updated: 2026-10-20

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
- [x] BOQ/document feature implemented and verified in sandbox (branch `feature/boq-builder-documents`; pending lead review, not yet in the real repo)
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


---

## Feature 2: BOQ Builder + Document Generation — status (2026-10-20)
Branch `feature/boq-builder-documents`, created from `feature/project-foundation` (Feature 1 was never merged anywhere; `main` holds only the starter docs). Merge order for the real repo: Feature 1 PR first, then this one.

### Verification actually run (sandbox, native PostgreSQL 16.15)
| Check | Result |
|---|---|
| Baseline before changes | backend 58/58, frontend 30/30 passing |
| Backend tests (6 files) | **197 passed, 0 failed** (58 existing + 139 new: calc vectors, schemas, BOQ API incl. rollback/concurrency/cross-project, PDF content, OpenAPI contract) |
| Frontend tests (4 files) | **85 passed, 0 failed** (30 existing + 55 new) |
| Backend `tsc --noEmit` + `tsc` build | passed |
| Frontend `tsc --noEmit` + `vite build` | passed (same >500 kB chunk-size warning as Feature 1) |
| Migrations from an empty database | `001` + `002` applied, re-run is a no-op; editing an applied migration is refused (checksum guard) |
| Migration on a database already at Feature 1 | applied `002` only |
| Real-browser end-to-end (Chromium, live API + PostgreSQL), 16 steps | all passed: create, live exact totals, rounding, unpriced item, persistence after reload, real PDF download whose text was checked with `pdftotext`, edit + reorder (stable ids, revision 2), unsaved-changes guard, concurrent-edit 409 and reload, delete, mobile layout without horizontal overflow |
| PDF visual inspection | multi-page output (header repeat, footers, long text, extreme values) rendered with `pdftoppm` and inspected; one layout flaw (narrow Unit column) found and fixed |

### Regressions / changes to existing files (all intentional and minimal)
- `backend/tests/api.test.ts`: `TRUNCATE projects` → `TRUNCATE projects CASCADE` (required by the new foreign key; no assertion changed).
- `frontend/src/test/ui.test.tsx`: render helper switched from `MemoryRouter + <App/>` to `createMemoryRouter(routes)` (data router); no assertion changed.
- `frontend/src/App.tsx`, `main.tsx`: `BrowserRouter` → `createBrowserRouter` (needed for unsaved-changes blocking).
- `ProjectDetailPage`: new "Bill of Quantities" card; roadmap placeholder "BOQ & documents" reworded to "Quotation requests & OCR" (BOQ is real now); sidebar roadmap item renamed "Document OCR".
- Shared files extended, not rewritten: `schemas`-adjacent `errors.ts` (3 new codes; `ERROR_CODES` constant), `app.ts` (route mounting, `Content-Disposition` exposed to CORS), `api/types.ts`, `api/client.ts` (`apiBlob`), `lib/constants.ts`, `lib/format.ts` (`formatMoneyFixed`), `components/ui.tsx` (`ConfirmDialog`), `styles.css`, `docs/openapi.yaml`.
- Feature 1 API endpoints, schema, dashboard and demo mode are unchanged (their tests pass untouched). BOQs are not part of dashboard metrics; the demo seed does not create BOQs.

### Known limitations / not verified
- **No authentication/authorization** (as Feature 1). Any client can read/modify/delete any BOQ.
- Text in Devanagari, CJK and other scripts not covered by DejaVu Sans cannot be exported (clear 422 error); a broader bundled font would be needed.
- PDFs are generated on demand; no archived snapshot of issued documents (revision pinning prevents preview/export mismatch, but old revisions are not retrievable).
- No taxes/GST/overheads by design; base total only. Currencies are never converted.
- Reordering uses up/down buttons (no drag-and-drop). BOQ lists per project are not paginated. No BOQ duplication/import/Excel export.
- Whole-BOQ optimistic locking: concurrent edits are detected, not merged.
- PDF was checked with poppler (`pdftotext`/`pdftoppm`) and pdf.js; not opened in Acrobat/Preview/other viewers. Screen-reader behaviour and colour contrast not audited (labels, roles, focus handling were implemented and unit-tested).
- Docker Compose path is still unverified (Docker unavailable in the sandbox).
- **Git:** the sandbox repo has no remote; nothing was pushed (see README for the exact commands).

### Next dependency and owner
- Project lead: review Feature 1 + Feature 2 contract proposals together (statuses, units, currency snapshot rule, base-total definition, removal of the BOQ lifecycle status).
- Pricing/ML owner: consume `GET /api/boqs/{id}` (`description`, `specifications`, `unit`, `quantity`); canonical-item linkage fields will be added in their migration.
