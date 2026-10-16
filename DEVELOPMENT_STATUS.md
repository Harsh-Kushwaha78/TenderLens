# TenderLens — Development Status

Last updated: 2026-10-16

## Current stage
Planning / repository bootstrap. No implementation should be assumed complete merely because it is described in the planning documents.

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
- [ ] Starter docs committed
- [ ] Shared architecture and API contract reviewed
- [ ] Project foundation implemented
- [ ] Project foundation tests/build verified
- [ ] BOQ/document feature integrated
- [ ] OCR feature integrated
- [ ] Pricing service integrated
- [ ] Quotation comparison integrated
- [ ] Milestone and reconciliation features integrated
- [ ] End-to-end demo verified

## Current feature
Not started: Project foundation.

## Known issues / decisions pending
- Exact authentication provider and user/organization model must be determined from the repository before implementation.
- Final database and API schemas must be confirmed against the actual repository.
- Market-data sources and initial benchmark category need to be selected before claiming real predictive capability.
- Deployment target and object storage provider are not yet fixed.

## Update instructions
After each feature, update this file with completed feature and commit/PR reference; actual tests/builds and results; API/schema changes; known bugs and limitations; next dependency and owner.
