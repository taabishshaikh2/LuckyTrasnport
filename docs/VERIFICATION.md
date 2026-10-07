# Verification and release status

Implemented source, October 7, 2026. This is a working Phase 1 implementation with provisional business formats, not a deployed or operationally accepted billing system.

## Executed checks

- Production Vite build completed.
- Business-logic tests cover Indian fiscal-year boundaries, distance slab edges, rate validity/ambiguity, included duty, overtime, each billing method, adjustments and override reasons, decimal rounding, GST exclusivity, round-off, Indian amount words, partial/full/overdue payment states, import aliases/validation, vehicle normalization and backend roles.
- MongoDB replica-set integration tests exercise the real Express API: authentication/roles, master creation, duplicate vehicle constraints, concurrent atomic sequence generation, trip preview and fleet reservation, assigned-driver access, invoice numbering, repeat billing prevention, invoicing before duty completion, concurrent payment balance enforcement, partial/full payments, cancellation restrictions, authenticated PDF/DOCX/XLSX endpoints, import preview/confirmation and duplicate prevention.
- Local browser checked administrator sign-in and a seeded trip: 17 FT, 42 KM, 15 hours, base 4,000 + overtime 750 = 4,750 INR. Trip submission persisted and details loaded. Mobile responsive checks target 360, 375, 390 and 414 pixels.
- Production dependency audit reports zero known vulnerabilities at verification time. SheetJS uses its maintained official distribution. An audit does not guarantee absence of unknown vulnerabilities.

## External completion steps

1. Obtain the original Excel workbooks and remaining owner answers. Photo references are supplied; validate the import and provisional billing rules against actual company files.
2. Configure company identifiers, banking, tax choices and commercial clauses. Tax percentages deliberately require user entry and confirmation.
3. Create Atlas and Render resources, configure exact CORS origins and environment secrets, and verify the health endpoint and database indexes.
4. Provision a production administrator: set temporary process variables BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD (12+ characters), optional BOOTSTRAP_NAME and MONGODB_URI; run `npm run bootstrap --workspace server`. Clear the password variables. The bootstrap refuses to run when an active administrator exists. Never seed sample users or rates into production.
5. Have staff accept the complete workflow on their phones, inspect actual PDF/DOCX/XLSX outputs, test restore procedures and agree on backup retention.

## Known Phase 1 constraints

Each valid import row creates one draft trip, including mixed vehicles. Each upload shares one customer/route default; different customer/route groups need separate uploads. Dates select configured effective-dated rates. Full sheet columns, source amounts, table detection, duration formats, pickup arrival calculation, overnight warnings, duplicate rows and overlapping files are supported. Billing-group pass allocation and final overtime/VVR rules await owner confirmation. Display/export cap at 2,000 records; large-batch performance and exact printed-layout acceptance remain pending. Company configuration is editable by Admin in Settings and persisted as a singleton MongoDB profile. Managers can read it. Environment values provide initial defaults; each invoice retains its original profile snapshot. Financial revision/credit workflows and cancellations with received payments are intentionally blocked. No Phase 2 modules were built.

## Repeat verification

Run `npm test`, `npm run test:integration`, `npm run build`, and `npm audit --omit=dev`. Integration tests use a disposable MongoDB replica set and download an official MongoDB binary on first run; permit the download or provide the tool's MONGOMS_SYSTEM_BINARY environment variable. Render skips test-binary postinstall downloads via MONGOMS_DISABLE_POSTINSTALL. Local preview during development used an isolated real MongoDB instance; its data is temporary and is not production storage.

## Editable company profile update
Admin can edit company, tax, bank and invoice-clause fields at More → Settings. GET /api/settings allows Admin/Manager; PATCH /api/settings requires Admin, validates all fields and records an audit entry transactionally. New invoice tax calculations and document snapshots use the saved profile. Existing finalized invoice snapshots remain unchanged. Production build and 11 integration checks passed, including profile persistence, role restrictions, invalid PAN/IFSC rejection and invoice-history preservation.
