# TenderLens — Development Status

Last updated: 2026-10-21

## Current stage

Feature 1 (Project Foundation) has been merged into `main`.

Feature 2 (BOQ Builder + Document Generation) is under integration review through the `feature/boq-builder-documents` branch. Its implementation and test results were reported from the sandbox environment. The integrated application must still be verified after Feature 2 is merged.

## Decisions currently agreed

- **Product:** project procurement, document intelligence, evidence-backed price benchmarking and expense reconciliation.
- **Initial target:** construction/renovation projects, with a narrow first category set.
- **Proposed stack:** React + Vite, Node.js + Express, PostgreSQL, Python document service, Python pricing service.
- Project documents are generated from structured, provided/reviewed details. Missing values must remain missing or be clearly marked.
- OCR results are reviewed and corrected by a human when needed.
- Canonical item matching is separate from physical-object computer vision.
- Start pricing with a transparent baseline; train or refresh ML only when data and validation support it.
- Private project data is private by default.
- Four-person team with module ownership and an integration-first Git workflow.

## Completed

- [x] Private repository created.
- [x] Starter documentation committed.
- [x] Shared architecture and API contract documented.
- [x] Feature 1: Project Foundation implemented and merged into `main`.
- [x] Feature 1 tests and builds verified in the sandbox.
- [x] Feature 2: BOQ Builder + Document Generation implemented and verified in the sandbox.
- [ ] Feature 2 integrated into `main`.
- [ ] Integrated backend and frontend tests and builds verified against `main`.
- [ ] OCR feature integrated.
- [ ] Pricing service integrated.
- [ ] Quotation comparison integrated.
- [ ] Milestone and reconciliation features integrated.
- [ ] End-to-end demo verified.

## Current feature

**Feature 2: BOQ Builder + Document Generation — integration review.**

## Verification actually reported for Feature 1 and Feature 2

The following results are documented as having been obtained in the sandbox environment. They have not been independently rerun against the updated GitHub `main` branch.

### Baseline before Feature 2

| Check | Reported result |
|---|---|
| Backend tests | 58/58 passed |
| Frontend tests | 30/30 passed |

### Feature 2 backend tests

| Check | Reported result |
|---|---|
| Backend tests across six files | 197 passed, 0 failed |
| Existing tests | 58 |
| New tests | 139 |
| Coverage areas | Calculation vectors, schemas, BOQ API, rollback, concurrency, cross-project access, PDF content and OpenAPI contract |
| TypeScript `tsc --noEmit` | Passed |
| TypeScript build | Passed |

### Feature 2 frontend tests

| Check | Reported result |
|---|---|
| Frontend tests across four files | 85 passed, 0 failed |
| Existing tests | 30 |
| New tests | 55 |
| TypeScript `tsc --noEmit` | Passed |
| Vite production build | Passed, with the same chunk-size warning reported for Feature 1 |

### Database and browser verification

- Migrations `001` and `002` were reported as successfully applied to an empty database.
- Re-running migrations was reported as a no-op.
- The migration checksum guard was tested against changes to an applied migration.
- Migration `002` was tested against a database already at Feature 1.
- A 16-step real-browser test using Chromium, the live API and PostgreSQL was reported as passing.
- The browser test covered creation, exact totals, rounding, unpriced items, persistence after reload, PDF download, editing, reordering, revision tracking, unsaved-change protection, concurrent-edit conflicts, deletion and mobile layout.
- PDF output was inspected using `pdftotext`, `pdftoppm` and pdf.js.
- A narrow Unit column layout issue was found and fixed during PDF inspection.

**These results are sandbox results, not a claim that the current integrated `main` has passed the same checks.**

## Feature 2 implementation summary

Feature 2 adds the following functionality:

- BOQ creation, listing, viewing and editing.
- Backend APIs for BOQs and BOQ items.
- Database migration `002_create_boqs.sql`.
- Decimal-safe quantity and rate calculations.
- Server-side PDF generation.
- Frontend BOQ editor, preview and PDF download.
- Unsaved-change protection.
- Optimistic concurrency checks for whole-BOQ edits.
- OpenAPI updates, integration contracts and additional automated tests.

## Intentional changes to existing files

The following changes were documented as intentional:

- `backend/tests/api.test.ts`: changed `TRUNCATE projects` to `TRUNCATE projects CASCADE` because of the new foreign key; no assertion was changed.
- `frontend/src/test/ui.test.tsx`: changed the test render helper from `MemoryRouter + <App/>` to `createMemoryRouter(routes)` to support the data router.
- `frontend/src/App.tsx` and `frontend/src/main.tsx`: replaced `BrowserRouter` with `createBrowserRouter` to support unsaved-change blocking.
- `ProjectDetailPage`: added a Bill of Quantities card and updated roadmap labels to reflect the implemented BOQ feature and future OCR functionality.
- Shared files were extended to support BOQ routes, PDF downloads, error codes, API types, formatting, confirmation dialogs, styles and OpenAPI documentation.
- Feature 1 API endpoints, schema, dashboard and demo mode were reported as unchanged; their tests passed in the sandbox.

## Known limitations and unverified areas

- **Authentication and authorization are not implemented.** Any client able to reach the current API may be able to read, modify or delete BOQs. Access controls must be addressed before production use with real project data.
- Devanagari, CJK and other scripts not covered by DejaVu Sans cannot currently be exported to PDF. The application returns a clear 422 error for unsupported text.
- PDFs are generated on demand. Previously issued document snapshots are not archived, although revision pinning prevents preview/export mismatch.
- Taxes, GST and overheads are intentionally excluded; totals represent the base total only.
- Currencies are not converted.
- Reordering uses up/down buttons rather than drag-and-drop.
- BOQ lists are not paginated.
- BOQ duplication, import and Excel export are not implemented.
- Whole-BOQ optimistic locking detects concurrent edits but does not merge them automatically.
- PDF checks were performed with Poppler and pdf.js. Acrobat, Preview and other viewers were not tested. Screen-reader behaviour and colour contrast have not been audited.
- Docker Compose remains unverified because Docker was unavailable in the sandbox.
- The sandbox repository had no remote, and its implementation was not pushed directly from that environment. The real GitHub branch must be verified independently.

## Known decisions still pending

- Confirm the authentication provider and user/organization model against the integrated repository.
- Confirm database and API schemas against the actual repository.
- Select market-data sources and the initial benchmark category before claiming predictive capability.
- Finalize the deployment target and object storage provider.
- Confirm shared contract decisions for statuses, units, currency snapshot rules, base-total definition and removal of the BOQ lifecycle status.

## Integration workflow

1. Feature 1 has been merged into `main`.
2. Review and resolve the Feature 2 pull request against the updated `main`.
3. Verify the final combined documentation and code changes.
4. Run backend tests, frontend tests, type checks and production builds.
5. Apply migrations in a test database and verify the BOQ workflow end-to-end.
6. Merge Feature 2 only after reviewing the changes and confirming required checks.
7. Update this document with the actual merge commit or PR reference and verified results.

## Next dependency and owner

- **Project lead:** review Feature 1 and Feature 2 contract proposals together, including statuses, units, currency snapshot rules, base-total definition and BOQ lifecycle decisions. Confirm that the integrated database and API contracts are consistent.
- **Pricing/ML owner:** consume `GET /api/boqs/{id}` fields `description`, `specifications`, `unit` and `quantity`. Canonical-item linkage fields are expected to be added in the relevant future migration.
- **Next feature:** canonical item matching and pricing, after Feature 2 is integrated and the relevant contracts are agreed.

## Update instructions

After each feature, update this document with:

- Completed feature and commit/PR reference.
- Actual test and build commands and results.
- API and database schema changes.
- Known bugs, limitations and unverified areas.
- Next dependency and owner.

Never mark a feature as integrated merely because it is implemented in a sandbox or exists on a feature branch.