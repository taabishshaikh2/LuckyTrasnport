# Verification and release status

Implemented source, October 7, 2026. This is a working Phase 1 implementation with provisional business formats, not a deployed or operationally accepted billing system.

## Executed checks

- Production Vite build completed.
- Business-logic tests cover Indian fiscal-year boundaries, distance slab edges, rate validity/ambiguity, included duty, overtime, each billing method, adjustments and override reasons, decimal rounding, GST exclusivity, round-off, Indian amount words, partial/full/overdue payment states, import aliases/validation, vehicle normalization and backend roles.
- MongoDB replica-set integration tests exercise the real Express API: authentication/roles, master creation, duplicate vehicle constraints, concurrent atomic sequence generation, trip preview and fleet reservation, assigned-driver access, invoice numbering, repeat billing prevention, invoicing before duty completion, concurrent payment balance enforcement, partial/full payments, cancellation restrictions, authenticated PDF/DOCX/XLSX endpoints, import preview/confirmation and duplicate prevention.
- Local browser checked administrator sign-in and a seeded trip: 17 FT, 42 KM, 15 hours, base 4,000 + overtime 750 = 4,750 INR. Trip submission persisted and details loaded. Mobile responsive checks target 360, 375, 390 and 414 pixels.
- Production dependency audit reports zero known vulnerabilities at verification time. SheetJS uses its maintained official distribution. An audit does not guarantee absence of unknown vulnerabilities.

## External completion steps

1. Supply real challan, rate chart, workbook and invoice examples. Validate the provisional grouping, duty-hours/GT interpretation, rate application and templates against known company cases.
2. Configure company identifiers, banking, tax choices and commercial clauses. Tax percentages deliberately require user entry and confirmation.
3. Create Atlas and Render resources, configure exact CORS origins and environment secrets, and verify the health endpoint and database indexes.
4. Provision a production administrator: set temporary process variables BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD (12+ characters), optional BOOTSTRAP_NAME and MONGODB_URI; run `npm run bootstrap --workspace server`. Clear the password variables. The bootstrap refuses to run when an active administrator exists. Never seed sample users or rates into production.
5. Have staff accept the complete workflow on their phones, inspect actual PDF/DOCX/XLSX outputs, test restore procedures and agree on backup retention.

## Known Phase 1 constraints

One import worksheet creates one header trip. Mixed vehicles/customers must be split beforehand. Aggregate imported duty/distance drives a single selected rate rule; no inference of daily billing is made. Source GT amounts do not affect charges without explicit adjustments. Overnight time inference and the real challan formulas await the company source documents. Display and export currently cap at 2,000 records; add server pagination for larger datasets. Excel formatting uses clear headings, widths, ISO-derived dates, currency formats, filters and total formula, without a reproduction of the unprovided company sheet. Company configuration is editable by Admin in Settings and persisted as a singleton MongoDB profile. Managers can read it. Environment values provide initial defaults; each invoice retains its original profile snapshot. Financial revision/credit workflows and cancellations with received payments are intentionally blocked. No Phase 2 modules were built.

## Repeat verification

Run `npm test`, `npm run test:integration`, `npm run build`, and `npm audit --omit=dev`. Integration tests use a disposable MongoDB replica set and download an official MongoDB binary on first run; permit the download or provide the tool's MONGOMS_SYSTEM_BINARY environment variable. Render skips test-binary postinstall downloads via MONGOMS_DISABLE_POSTINSTALL. Local preview during development used an isolated real MongoDB instance; its data is temporary and is not production storage.

## Editable company profile update
Admin can edit company, tax, bank and invoice-clause fields at More → Settings. GET /api/settings allows Admin/Manager; PATCH /api/settings requires Admin, validates all fields and records an audit entry transactionally. New invoice tax calculations and document snapshots use the saved profile. Existing finalized invoice snapshots remain unchanged. Production build and 11 integration checks passed, including profile persistence, role restrictions, invalid PAN/IFSC rejection and invoice-history preservation.
