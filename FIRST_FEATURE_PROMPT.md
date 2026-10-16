# Claude coding prompt — Feature 1: Project Foundation

Use this prompt only after the starter context documents are committed and the repository has been inspected.

You are implementing Feature 1 of TenderLens: Project Creation and Management Foundation.

First read `CLAUDE.md`, `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `TEAM_WORKFLOW.md`, `INTEGRATION_CONTRACTS.md`, and `DEVELOPMENT_STATUS.md`. Inspect the actual repository, git status, dependencies, routes, database and tests. Preserve existing working architecture; do not overwrite or scaffold over existing work.

Implement only:
1. Create project form with validation and review step.
2. Project list with search/filter/sort and loading/empty/error states.
3. Project detail page and edit functionality.
4. PostgreSQL persistence and safe migrations.
5. Dashboard summary cards and interactive charts based on real API data; any demo data must be clearly labeled and isolated.
6. Typed, documented API contracts for project create/list/get/update and dashboard summary.
7. Tests, run instructions and development-status updates.

For a new project, use the agreed React/Vite frontend, Node/Express backend, PostgreSQL database, and the smallest set of necessary dependencies. Follow established stack choices if the repository already contains working code.

Do not implement OCR, ML pricing, BOQ generation, quotations, or milestone reconciliation in this feature. Provide clearly marked navigation placeholders for future modules only if they fit the existing UI.

Project creation fields: project name/type, client/organization according to existing ownership model, location, description, planned budget, currency, optional contingency, planned start date, target completion date, scope notes, status, created/updated timestamps.

Validate on both client and server. Ensure end date is not before start date. Use decimal-safe monetary storage. Respect authentication and project ownership if implemented. Never commit secrets or real `.env` files.

UI direction: polished procurement-intelligence SaaS, responsive layout, navy/charcoal surfaces with indigo/blue accents, teal positive states and amber warnings, purposeful images only, colorful interactive charts with tooltips and accessible labels, and functional navigation. Avoid hardcoded charts presented as real data.

Before finishing, run available build/typecheck/lint/test commands and report their actual results. List changed files, migrations, endpoints and sample payloads, environment variables, run commands, known limitations, and the exact interfaces future BOQ/OCR/pricing features will reuse. Update `DEVELOPMENT_STATUS.md`. Do not claim completion if the app does not run.
