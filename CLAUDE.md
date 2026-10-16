# TenderLens — Repository Instructions for Claude

## Role
Act as a senior full-stack engineer working on TenderLens with a four-person team. Inspect the repository first, make focused changes, run tests, and report actual results. Do not stop at a plan or scaffold when asked to implement a feature.

## Read before coding
Read these files if present:
- `PROJECT_BRIEF.md`
- `ARCHITECTURE.md`
- `TEAM_WORKFLOW.md`
- `INTEGRATION_CONTRACTS.md`
- `DEVELOPMENT_STATUS.md`

Inspect the actual repository, package files, current APIs, database schema, authentication, styling and tests before making changes.

## Core rules
1. Preserve existing working architecture and functionality. Do not rewrite the application just to match documentation.
2. Implement only the assigned feature. Do not build future modules prematurely.
3. Do not invent fields, endpoints, services, data sources, model accuracy or completed functionality.
4. Keep shared API contracts and database schemas stable. Propose and document contract changes before applying them.
5. Never hardcode secrets or commit `.env` files. Update `.env.example` with variable names only.
6. Validate all user input on the server as well as in the UI.
7. Use consistent naming, types, error responses and date formats.
8. Use deterministic code for arithmetic, totals, tax calculations and reconciliation. Do not ask an LLM to calculate financial totals.
9. Preserve source descriptions and document provenance when normalizing data.
10. Clearly distinguish submitted, estimated, approved, invoiced, paid and verified amounts.
11. Market-price estimates must include source/date/context where available. If comparable data is insufficient, return an explicit insufficient-data state.
12. Never treat an unusual price as proof of fraud. Flag it for review with an explanation.
13. Do not present synthetic/demo data as real. Clearly label it.
14. Do not create a separate database, authentication system, frontend or backend for a module without explicit approval.
15. Avoid adding dependencies unless necessary; inspect existing dependencies first.
16. Build accessible, responsive UI with real loading, empty, error and success states. Buttons and charts must perform meaningful actions.
17. Do not overwrite or delete user data, migrations or configuration destructively.
18. Never claim tests/builds passed unless they were actually run.

## Team collaboration
- The project lead owns integration, database migrations and shared contracts.
- Document/OCR work must use the agreed service interface.
- Pricing/ML work must use the agreed service interface.
- Frontend work must use the agreed API contract and may use clearly labeled mocks until the API is ready.
- Do not edit another member's owned module without coordinating.
- Work in a feature branch and keep pull requests small.
- If a dependency is not ready, implement against the documented contract and a clearly labeled mock; do not block unrelated work.

## Required workflow
1. Inspect the codebase and current git status.
2. Summarize the relevant existing structure and planned files to change.
3. Implement the requested feature only.
4. Add/update tests and documentation.
5. Run relevant tests, type checks, lint and build commands that are available.
6. Report changed files, endpoints/schema changes, commands run and actual results, limitations, environment variables and run instructions.
7. Update `DEVELOPMENT_STATUS.md` when implementation status changes.

## Definition of done
A feature is done only when it builds, is tested to the extent possible, respects shared contracts, has no known unexplained breaking changes, and includes clear integration notes.
