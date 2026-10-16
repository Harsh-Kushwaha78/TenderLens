# TenderLens — Planned Architecture

This is the intended architecture for a new implementation. Inspect the actual repository first and preserve any working implementation that already exists.

## Components
- Frontend: React + Vite; TypeScript preferred for a new project.
- Main API: Node.js + Express; TypeScript preferred for a new project.
- Database: PostgreSQL.
- Document service: Python service for OCR/extraction and document generation utilities as needed.
- Pricing service: Python service for canonical item matching, benchmark calculations and ML predictions.
- File storage: local shared uploads folder for early local development; later object storage behind a storage abstraction.
- API contract: OpenAPI for the main API; validated request/response models for Python services.

Use the existing stack if already established. Do not add a framework/library solely to match this document.

## Request flow
Browser frontend → Node/Express API → PostgreSQL and/or Python services. The browser must not connect directly to PostgreSQL or call internal Python services directly. The main backend coordinates persistence and service calls.

## Responsibility boundaries
### Main backend
Authentication/authorization according to the established system; project/workflow records; validation and business rules; database transactions and persistence; orchestrating document/pricing services; consistent API responses and audit events.

### Document service
Receive an authorized document reference or upload; OCR/extract text and tables; return structured fields with confidence/warnings; support human review and correction; generate documents from explicit structured data and templates. Never fabricate missing values.

### Pricing service
Normalize item descriptions against canonical item definitions; validate comparability and units; calculate a baseline from comparable observations; later run ML price estimation when data quality/quantity supports it; return estimate range, date/context, provenance and confidence/limitations; explicitly report insufficient data.

### Frontend
Form and workflow UX; calls only documented main API endpoints; displays real API data when available; mocks are allowed only while clearly marked and separated from production data.

## Database principles
- Use migrations; do not reset or destructively alter shared databases.
- Monetary values should use a safe decimal representation, not binary floating-point arithmetic.
- Keep currencies and units explicit.
- Use consistent timestamps and ISO 8601 in API payloads.
- Keep separate fields/statuses for planned budget, quoted/committed amount, reported expense, invoice amount, approved amount, paid amount and verified work.
- Maintain project ownership and access checks.
- Do not create every future feature table before it is needed.

## Reliability and security
Validate input at API boundaries; set upload size/type limits; do not trust filenames or MIME headers alone; never execute uploaded files; keep secrets in environment variables; use predictable error formats and useful logs without leaking secrets or sensitive document contents; preserve source references and audit significant edits/approvals.
