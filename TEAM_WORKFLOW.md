# TenderLens — Four-Person Team Workflow

## Roles
### Member 1 — Project lead / integration / backend
Owns repository setup, shared architecture, main API, database migrations, project management APIs, API contract, integration tests, reviewing/merging pull requests and keeping main runnable.

### Member 2 — Document generation and OCR
Owns BOQ and quotation-request templates, PDF/Excel export as agreed, OCR and structured extraction from digital/scanned PDFs, confidence/warning fields, correction support, tests and integration documentation.

### Member 3 — Canonical item model and pricing/ML
Owns canonical item taxonomy and aliases, price observation schema/provenance, data validation, baseline comparison, ML experiments only when data supports them, pricing service contract, evaluation and tests.

### Member 4 — Frontend and workflow UI
Owns project forms/list/detail views, document upload/review UX, quotation comparison and analytics screens as APIs become available, responsive layout, charts, accessibility and frontend tests. Uses documented API contracts and mocks only while dependencies are unavailable.

Roles can be adjusted, but every module must have one clear owner.

## Integration-first rules
1. Create one private GitHub repository and protect `main` through team rules where possible.
2. Commit starter docs before implementation.
3. Agree on schemas/endpoints before parallel implementation.
4. Each person works on a feature branch and opens small pull requests.
5. No one pushes unfinished work directly to `main`.
6. The project lead reviews changes affecting shared schemas, migrations, API contracts, auth or environment setup.
7. Integrate continuously. Do not wait until all modules are complete.
8. Use mocks that match the real contract when a dependency is not ready.
9. Every pull request states purpose, files changed, contract/schema changes, tests run, known limitations and how to test.
10. After merge, pull the latest `main` and rerun relevant tests before starting dependent work.

## Suggested branch names
- `feature/project-foundation`
- `feature/document-ocr`
- `feature/pricing-benchmark`
- `feature/frontend-project-workflow`

Use your team's actual names if preferred, but avoid overlapping file ownership.

## Dependency-aware build order
### Stage 0 — shared foundation
Repository, instructions, env example, API conventions and initial architecture. Establish run/test commands. Agree on the project data model and error format.

### Stage 1 — project foundation
Project create/list/detail/update API and database migration. Frontend may build against a typed mock contract in parallel. Confirm end-to-end project creation before depending on project IDs.

### Stage 2 — BOQ and documents
Agree on BOQ item schema. Build BOQ editor and document templates. OCR can be developed with sample documents and test fixtures. Integrate document records through the main API.

### Stage 3 — canonical items and pricing
Agree on canonical item and price observation schemas. Start with a transparent statistical baseline. Test on held-out/later-dated observations. Do not claim trained ML until a real training/evaluation pipeline exists.

### Stage 4 — quotations, milestones and reconciliation
Connect quotation rows to BOQ items. Track planned and actual dates. Reconcile separate financial states without conflating them. Add dashboards and exportable reports.

## Daily integration routine
Start of day: pull main, inspect issues and confirm dependencies. During day: commit small changes and push branches. End of day: run tests/build, open/update PRs, update development status. If blocked, implement against the agreed contract and a labeled mock; document what is needed for integration.

## Merge checklist
- [ ] Scope is limited to the assigned feature.
- [ ] No secrets or real private documents were committed.
- [ ] Shared contracts/migrations are documented.
- [ ] Build/typecheck/lint/tests run where available.
- [ ] No unrelated files or dependencies changed unnecessarily.
- [ ] README or development status updated.
- [ ] Integration steps and limitations are clear.
