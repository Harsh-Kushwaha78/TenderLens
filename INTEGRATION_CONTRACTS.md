# TenderLens — Initial Integration Contracts

These are starting conventions, not a substitute for inspecting the real codebase. The project lead must finalize and version the API schemas before dependent modules implement against them.

## General API conventions
- JSON request and response bodies.
- API timestamps use ISO 8601.
- Use one naming convention consistently; recommended JSON fields are camelCase.
- Monetary values are decimal-safe. Choose and document whether they are represented as decimal strings or integer minor units; do not silently use JavaScript floating-point arithmetic for financial totals.
- Example error shape:
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable explanation",
      "details": []
    }
  }
- Never return stack traces, secrets or sensitive internal details to clients.
- Include pagination/filter conventions before implementing large list endpoints.
- Validate every request at the server boundary.

## Initial Project object (logical shape)
{
  "id": "server-generated identifier",
  "name": "Renovation project",
  "projectType": "building_renovation",
  "clientName": "Example Client",
  "location": {
    "city": "Ghaziabad",
    "state": "Uttar Pradesh",
    "postalCode": null
  },
  "description": "Optional scope summary",
  "plannedBudget": "1000000.00",
  "currency": "INR",
  "contingencyBudget": null,
  "plannedStartDate": "2026-11-01",
  "targetCompletionDate": "2026-12-15",
  "status": "draft",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp"
}

This is an example only. Do not seed it as real user data. Final types and required/optional fields must be defined in the API schema and database migration.

## Project statuses
Start with a small set: draft, planning, active, on_hold, completed, cancelled. Do not add statuses without a workflow need.

## Initial endpoint proposals
- `POST /api/projects` — create project
- `GET /api/projects` — list/search/filter projects
- `GET /api/projects/:id` — get project
- `PATCH /api/projects/:id` — update project
- `GET /api/dashboard/summary` — dashboard counts and summary values

Use existing route/versioning conventions if present. The project lead must document exact request/response schemas in OpenAPI.

## Future logical objects
### BOQ item
Preserve raw user description and canonical matching fields: id, projectId, description, specifications, quantity, unit, optional estimatedUnitRate, source, nullable canonicalItemId, matchStatus and confidence where applicable.

### Document
id, projectId, documentType, originalFilename, storageKey or controlled file reference, extractionStatus, uploadedBy, createdAt, plus extraction metadata, warnings and provenance as appropriate.

### Price estimate
canonicalItemId or reviewed item reference, location and context, currency and unit, predicted low/high or benchmark range, asOfDate, sources/provenance, confidence/limitations, modelVersion or method used.

### Milestone
id, projectId, name, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, status, approved change references if needed.

Do not implement these future objects until the relevant feature begins. Finalize their contracts with the owning team members first.

## Future service boundaries
- Document service: main API sends an authorized document reference or upload; service returns structured extracted fields plus confidence/warnings and does not write directly into the main database.
- Pricing service: main API sends item specifications, unit, location, date/context and eligible observations or a controlled lookup key. Service returns a price range, methodology/model version, source references, confidence and limitations. It must support insufficient-data results.

## Contract-change procedure
1. Describe the use case and why the current contract is insufficient.
2. Propose the schema/API change.
3. Update this document and OpenAPI/Pydantic schemas.
4. Notify owners of dependent modules.
5. Update mocks, fixtures and tests.
6. Merge the contract change before dependent feature implementation.

---

# Feature 1 — Project Foundation: contract decisions (PROPOSED, pending project-lead review)

Authoritative machine-readable contract: `docs/openapi.yaml`. Server validation: `backend/src/schemas.ts`. Frontend mirror: `frontend/src/api/types.ts`, `frontend/src/lib/{constants,validation}.ts`.
These were implemented in a sandbox, not in the shared GitHub repo. Per the contract-change procedure, the project lead must review before dependent modules build on them.

## Decisions
| Topic | Decision |
|---|---|
| Money | Decimal **strings** in JSON (`"1000000.00"`), `NUMERIC(15,2)` in PostgreSQL. Max 13 whole digits, 2 decimals. No JS floats for money. Responses always carry 2 fraction digits. |
| Dates | `plannedStartDate`, `targetCompletionDate`: calendar dates `YYYY-MM-DD` (`DATE`, no timezone). `targetCompletionDate >= plannedStartDate`. |
| Timestamps | `createdAt`, `updatedAt`: ISO 8601 UTC (`TIMESTAMPTZ`). |
| IDs | Server-generated UUID. |
| Naming | camelCase JSON; snake_case columns. |
| Envelope | Success: `{ "data": ... }` (+ `pagination` for lists). Errors: `{ "error": { code, message, details: [{ field?, message }] } }`. |
| Error codes | `VALIDATION_ERROR` 400, `BAD_REQUEST` 400 (malformed JSON/too large), `NOT_FOUND` 404, `INVALID_STATUS_TRANSITION` 409, `SERVICE_UNAVAILABLE` 503, `INTERNAL_ERROR` 500. Never stack traces or DB internals. |
| Statuses | `draft, planning, active, on_hold, completed, cancelled` (from this document). |
| Transitions (proposed) | draft→planning,cancelled · planning→active,on_hold,cancelled · active→on_hold,completed,cancelled · on_hold→active,cancelled · completed, cancelled are final. Same-status update is allowed. New projects may start only as `draft` or `planning`. |
| Project types (proposed) | `building_renovation, interior_fitout, civil_works, electrical_works, plumbing_works, other` |
| Currencies (proposed) | `INR, USD, EUR, GBP, AED`. Currencies are never summed or converted together. |
| `clientName` | Free-text string. Organization ownership is deliberately not modelled (no auth yet). |
| `scopeNotes` | **Not added.** `FIRST_FEATURE_PROMPT.md` lists "scope notes" but the contract's Project object has only `description` ("Optional scope summary"); `description` serves that purpose. |
| Extra fields | `isDemo` (read-only; true only for rows from the dev seed script). |
| Reserved columns | `projects.organization_id` (nullable UUID, not exposed) reserved for future organization-based ownership/RBAC. `projects.idempotency_key` supports `Idempotency-Key` on create. |
| Update semantics | `PATCH` partial; `location` replaced as a whole object; `null` clears `description`/`contingencyBudget`/`location.postalCode`; unknown or read-only fields are rejected (400). Concurrency is last-write-wins (row-locked, no ETag/version yet). |
| Pagination | `page` (≥1), `pageSize` (1–100, default 10); response `pagination: { page, pageSize, totalItems, totalPages }`. |
| Dashboard rules | "Active" = status `active`. "Approaching" = status in planning/active/on_hold with target date from today through today+30 days; "overdue" = same statuses, target date before today. "Today" uses `APP_TIMEZONE` (default `Asia/Kolkata`). Planned-budget totals exclude `cancelled` projects, grouped per currency. Creation trend is only marked `sufficient` with ≥5 projects across ≥2 of the last 6 months. |
| Demo data | `isDemo=true` rows are excluded from every endpoint unless `includeDemo=true`; the UI has an explicit "Show demo data" switch and banners. Clients cannot set `isDemo`. |
| Auth | **None.** Development only. Do not use with real or confidential data. |

## Interfaces future modules should reuse
- Reference a project by `projectId = projects.id` (UUID). Fetch with `GET /api/projects/:id`. Add child tables with `project_id UUID REFERENCES projects(id)` via a new numbered file in `backend/migrations/`.
- Future ownership checks should hook in where routes load a project (`backend/src/projects/routes.ts`) and use `projects.organization_id`.
- Frontend: `src/api/client.ts` (`apiRequest`, `ApiClientError`), `src/components/ui.tsx` primitives, `src/lib/format.ts` (`formatMoney` takes decimal strings).
