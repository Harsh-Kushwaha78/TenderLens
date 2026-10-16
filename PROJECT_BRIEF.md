# TenderLens — Product Brief

## Product vision
TenderLens is an AI-assisted project procurement, document intelligence, price benchmarking and expense-verification platform. It helps a client and contractor maintain a shared, evidence-backed record of a project from planning through execution and reconciliation.

## Core workflow
1. Client creates a project with scope, location, budget and target dates.
2. Relevant technical specifications, quantities and units are entered or reviewed.
3. TenderLens generates draft BOQs and quotation requests from approved information.
4. Contractors submit quotations and supporting documents.
5. OCR extracts data from PDFs/scans; a human reviews and corrects uncertain extraction.
6. A canonical item model normalizes item descriptions and specifications.
7. Price intelligence compares submitted rates with relevant, dated market observations.
8. Quotations are compared using transparent criteria.
9. Approved scope, milestones, changes, expenses, bills, recorded payments and work evidence are tracked separately.
10. Reports and dashboards show cost deviations, evidence status, timeline and unresolved issues.

## Product positioning
**TenderLens — evidence-backed project cost and procurement intelligence.**

The differentiator is the combination of document extraction and normalization, context-aware price benchmarking with traceable evidence, quotation and BOQ comparison, project timeline and financial reconciliation, human review and an audit trail. Do not claim the product is the first of its kind or that OCR/ML alone is novel.

## Target scope for the first version
Start with construction/renovation projects and a small number of well-defined materials/services. Design the system to expand later, but do not support every industry in the MVP.

## Initial feature sequence
1. Project creation and project management foundation
2. BOQ creation and document generation
3. Document upload and OCR extraction/review
4. Canonical item matching and price benchmarking
5. Quotation comparison
6. Milestone/timeline tracking
7. Budget, expense, invoice, payment and work reconciliation
8. Exportable reports and dashboard improvements

## Key principles
- Client-defined scope and requirements are distinct from contractor-proposed rates, methods, materials and schedule.
- Generate documents only from provided/reviewed information. Do not invent quantities, specifications, prices, dates or approvals.
- BOQ, quotation request, quotation, work order and Letter of Award (LOA) are different document types.
- Generated award/work-order documents remain drafts until authorized approval.
- An invoice is evidence for a claim/purchase; by itself it does not prove delivery, consumption, price reasonableness or completed work.
- A contractor-submitted price is not automatically an independent market price.
- Market comparisons must consider specifications, units, location, date, taxes, transport/delivery, quantity, quality and other relevant context.
- An outlier is a review flag, not a fraud verdict.
- Preserve raw text, source document, extraction confidence, corrections and provenance.
- Private project data is private by default. Sharing or public disclosure requires appropriate authorization.
- Use synthetic data only when clearly labeled for demo/testing.
