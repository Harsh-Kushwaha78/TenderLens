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
