# TenderLens

Evidence-backed project cost and procurement intelligence. See `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `TEAM_WORKFLOW.md`, `INTEGRATION_CONTRACTS.md`, `DEVELOPMENT_STATUS.md`.

**Status: Feature 1 (projects, dashboard) and Feature 2 (BOQ builder + PDF documents).** No OCR, pricing/ML, quotation or reconciliation features exist yet.

> **Development build — no authentication.** Anyone who can reach the API can read and change every project. Do **not** use it with real customer or confidential data. `projects.organization_id` is reserved for future organization-based access control.

## Layout
```
backend/    Node 22 + Express + TypeScript API, SQL migrations, tests (vitest + supertest)
frontend/   React + Vite + TypeScript UI, charts (recharts), tests (vitest + Testing Library)
docs/       openapi.yaml (API contract)
docker-compose.yml, docker/initdb/   local PostgreSQL (unverified, see below)
```

## Requirements
Node >= 22.9, npm, PostgreSQL 16 (Docker or native).

## 1. Database
**Option A — Docker (not verified by the author; Docker was unavailable in the sandbox):**
```bash
cp .env.example .env            # set POSTGRES_PASSWORD
docker compose up -d db
```
**Option B — native PostgreSQL (this is what the tests were run on):**
```sql
CREATE USER tenderlens WITH PASSWORD '<choose-a-password>';
CREATE DATABASE tenderlens OWNER tenderlens;
CREATE DATABASE tenderlens_test OWNER tenderlens;   -- tests only
```

## 2. Backend
```bash
cd backend
cp .env.example .env            # fill in DATABASE_URL / TEST_DATABASE_URL (never commit .env)
npm install
npm run migrate                 # forward-only SQL migrations; safe to re-run; never drops data
npm run dev                     # http://localhost:4000  (health: /api/health)
npm run seed:demo               # OPTIONAL, dev only: 8 rows flagged is_demo=TRUE ("[DEMO] ..."); `-- --reset` deletes only demo rows
```
Environment variables: `DATABASE_URL` (required), `TEST_DATABASE_URL` (tests; db name must end `_test`), `PORT`, `CORS_ORIGIN`, `APP_TIMEZONE`, `NODE_ENV`.

## 3. Frontend
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 ; /api is proxied to http://localhost:4000
```
Optional: `VITE_API_BASE_URL` (API origin if not proxied), `VITE_DEV_API_TARGET` (dev proxy target). Demo rows appear only when the header switch **Show demo data** is on.

## 4. Tests and builds
```bash
cd backend  && TEST_DATABASE_URL=... npm test && npm run typecheck && npm run build
cd frontend && npm test && npm run build
```
Backend tests TRUNCATE the `projects` table in the `_test` database and refuse to run elsewhere.

## API
See `docs/openapi.yaml` and the "Feature 1" section of `INTEGRATION_CONTRACTS.md`. Endpoints: `POST/GET /api/projects`, `GET/PATCH /api/projects/:id`, `GET /api/dashboard/summary`, `GET /api/health`, and (Feature 2) `GET/POST /api/projects/:projectId/boqs`, `GET/PUT/DELETE /api/boqs/:id`, `GET /api/boqs/:id/pdf`.

Sample create:
```bash
curl -X POST localhost:4000/api/projects -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-key-0001' -d '{
  "name":"Office Renovation","projectType":"building_renovation","clientName":"Example Client",
  "location":{"city":"Ghaziabad","state":"Uttar Pradesh"},
  "plannedBudget":"1000000.00","currency":"INR",
  "plannedStartDate":"2026-11-01","targetCompletionDate":"2026-12-15"}'
```

## Transferring this work into the real GitHub repository
This code was written in a standalone sandbox repo, not the team's repo.
1. Download this folder (or `git bundle create tenderlens.bundle --all`).
2. In the real repo: `git checkout -b feature/project-foundation`.
3. **Inspect before copying** (per `CLAUDE.md`): if the real repo already has a stack, DB, auth or routes, merge by hand rather than overwriting; the lead owns migrations and contracts.
4. Copy `backend/`, `frontend/`, `docs/openapi.yaml`, `docker-compose.yml`, `docker/`, and the updated `INTEGRATION_CONTRACTS.md` / `DEVELOPMENT_STATUS.md` / `README.md`. Do not copy `node_modules`, `dist`, or any `.env`.
5. `npm install` in both packages, run migrations on a **non-production** database, rerun the tests and builds, then open a small PR describing the contract proposals.

## Feature 2 notes (BOQ + PDF)
- Run `npm run migrate` in `backend/` to apply `002_create_boqs.sql` (safe on an existing Feature 1 database; no new environment variables).
- PDF generation is server-side (PDFKit) with an embedded DejaVu Sans font from the `dejavu-fonts-ttf` npm package, so nothing needs to be installed on the host. Text in scripts the font lacks (e.g. Devanagari) is rejected with a clear 422 error.
- Open a project, use the **Bill of Quantities** card, build the BOQ, then **Download PDF** from the saved BOQ page.
- Tests: `backend/tests/contract.test.ts` checks `docs/openapi.yaml` against the running implementation; `docs/boq-calculation-vectors.json` is the shared arithmetic oracle for backend and frontend tests.

## Pushing a feature branch (this sandbox has no Git remote)
```bash
git remote add origin <your-private-github-url>     # only if no remote exists yet
git push -u origin feature/project-foundation        # Feature 1 first (if not already pushed)
git push -u origin feature/boq-builder-documents     # then Feature 2; open PRs, never push to main directly
```
