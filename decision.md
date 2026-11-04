# Decision log

Record started: 16 October 2026. This is a living log, not a reconstructed history of every earlier change.

## D001 - Keep decisions and execution flow beside the code

- Status: accepted by the user on 16 October 2026 (documentation changes only).
- Problem: future maintainers need the reasons behind changes and the path through the code.
- Decision: use root-level `decision.md` and `flow.md`, with durable instructions in `AGENTS.md`.
- Reason: Markdown is readable in GitHub, diffable and requires no extra library or service. The requested filenames are retained exactly.
- Alternative: only a Word/PDF handover. Useful for sharing, but harder to keep synchronized with each code review.
- Tradeoff: documentation needs maintenance; AGENTS.md requires updates alongside meaningful changes. It guides agents but is not a technical GitHub merge restriction.
- Scope: documentation only; no dependency, runtime or database changes.
- Verification: entry points and representative calls were checked against source. Runtime tests are unnecessary for this documentation-only change.

## D002 - Quiz before acceptance

- Status: accepted by the user on 16 October 2026 (documentation changes only).
- Decision: prepare and verify changes, then ask short questions about behaviour and tradeoffs before acceptance, commit/push/deployment.
- Reason: the user explicitly wants to understand changes before accepting them.
- Alternative: explain changes without checking understanding.
- Tradeoff: an extra conversation step; keep questions short and relevant. Unanswered questions never count as approval. Push/deployment still requires authorization.

## Baseline notes for already prepared local changes

These describe the existing implementation, not newly approved changes or a complete historical rationale.

### Mobile Settings shift fields

- Observed change: ShiftSettings.jsx uses labelled responsive form rows instead of the trip-sheet table; styles.css provides two columns on mobile, one below 360px, and Remove underneath.
- Reason supported by the reported bug: the shared trip table has a 1100px minimum width, which made Settings overflow and shrink on mobile.
- Tradeoff: repeated field labels use more vertical space but avoid horizontal scrolling for simple settings. No new library is needed.
- Verification recorded previously: client production build passed. Real iPhone layout remains to be confirmed. Status: local; acceptance under the new quiz rule pending.

### Expiry reminders

- Observed design: dashboard alerts are independent of email enablement. Email is off by default; the worker uses saved expiry dates, India calendar days, database delivery claims and provider idempotency.
- Tradeoff: an in-process scheduler cannot run while hosting sleeps. External scheduling and live Resend delivery remain deferred; do not describe them as configured.
- Relevant files: shared/vehicleExpiry.js; server/services/expiryReminderService.js; client/src/features/ExpiryAlerts.jsx and ReminderSettings.jsx; docs/expiry-reminders.md.
- Status: local implementation; external setup deferred. This note does not approve pending code.

## Template for the next meaningful change

- ID/date and status (prepared / awaiting quiz / accepted / superseded)
- Problem and desired behaviour
- Decision and reasons, including library choice if any
- Alternatives and accepted tradeoffs
- Affected files and flow.md updates
- Verification and remaining limitations
- Quiz questions, user answers and explicit acceptance reference

## D003 - Above 150 KM Overtime, Vehicle Compliance Permits, and Removal of Night Detention

- ID/date: D003 - 4 November 2026.
- Status: accepted (user explicitly authorized direct push to GitHub).
- Problem:
  1. Above 150 KM kilometre trips outside PNQ (such as Special multi-day trips like Cargo to Nashik) suppressed overtime calculation completely, resulting in 0 OT hours and ₹0 charges despite duty exceeding the 8-hour included allowance.
  2. Branded vehicle entry needed tracking and validation for Fitness Permit and Advertising Permit expiration alongside Insurance and PUC.
  3. Trip-based city services previously included a separate Night Detention charge, which is no longer billed and required complete removal from the rate chart, forms, calculation, and summaries.
- Decision and reasons:
  1. Updated `adhocRateService.js` so `applyOvertime: true` applies across kilometre-based services. For PNQ above 150 KM, 16 base hours and `pnqOvertimeRate` apply; for non-PNQ (including Special multi-day trips), 8 base hours and `chart.overtimeRate` (the rate chart's detention rate after 8 hrs) apply.
  2. Added `fitnessValid`, `fitnessExpiry`, `advertisingValid`, and `advertisingExpiry` to `Vehicle` model, Zod validation, UI master config, and `expiryAlerts` monitor in `shared/vehicleExpiry.js`. Expiry dates are validated only when the corresponding permit checkbox is checked and cleared when unchecked.
  3. Removed `nightDetention` from `CityRate` model and validator, removed `nightDetentionAmount` calculation in `tripCalculationService.js`, removed the column from Rate Chart UI in `Masters.jsx`, and removed night detention checkboxes from Adhoc trip forms and summaries.
- Alternatives:
  - Keep Night Detention optional: Rejected because the user explicitly requested removing the column and all related calculation logic.
  - Require separate rate rules for Special multi-day trips: Rejected in favor of using the vehicle's standard detention rate after 8 hours when above 150 KM outside PNQ.
- Tradeoffs:
  - Non-PNQ trips above 150 KM will now bill overtime whenever duty exceeds 8 hours (at `overtimeRate` per hour).
  - Night detention can no longer be configured or billed on city trips.
- Affected files:
  - `server/services/adhocRateService.js`
  - `server/services/tripCalculationService.js`
  - `server/models/index.js`
  - `server/validators/index.js`
  - `server/routes/invoices.js`
  - `server/scripts/loadAdhocRates.js`
  - `server/tests/adhocRates.test.js`
  - `server/tests/api.integration.js`
  - `server/tests/vehicleDocuments.test.js`
  - `shared/adhoc.js`
  - `shared/vehicleExpiry.js`
  - `client/src/features/masterConfig.js`
  - `client/src/features/AdhocTripForm.jsx`
  - `client/src/features/AdhocTripTable.jsx`
  - `client/src/components/UI.jsx`
  - `client/src/pages/Masters.jsx`
  - `flow.md`
- Verification:
  - `npm test` passed with 82/82 tests.
  - `npm run build` completed cleanly with Vite (0 errors).
- Quiz summary:
  1. Non-PNQ Above 150 KM trips calculate detention after 8 base hours using the rate chart's standard detention rate (`overtimeRate`).
  2. If the fitness or advertising permit checkbox is unchecked, expiry date is not required and is cleared to an empty string.
  3. Night detention is completely removed from city trip rates, calculations, and invoice summaries.
- User authorization: user explicitly instructed pushing directly to GitHub (`https://github.com/taabishshaikh2/LuckyTrasnport`).

## D004 - Client and Operational User Guide (Word, PDF, Markdown)

- ID/date: D004 - 4 November 2026.
- Status: accepted (created per user explicit instruction).
- Problem: The client needed a comprehensive yet simple and structured guide explaining all application features and operational workflows (masters, compliance permits, trip logging, branded shifts, invoicing models, payment tracking, and step-by-step cheatsheet).
- Decision: Generated `docs/Lucky_Transport_User_Guide.docx`, `docs/Lucky_Transport_User_Guide.pdf`, and `docs/USER_GUIDE.md` using the project's existing `docx` and `pdfkit` libraries via a reproducible generator script `server/scripts/generateUserGuide.js`.
- Tradeoffs: Maintained as both binary documents (DOCX and PDF for client distribution) and plain Markdown for Git version tracking.
- Affected files:
  - `docs/Lucky_Transport_User_Guide.docx`
  - `docs/Lucky_Transport_User_Guide.pdf`
  - `docs/USER_GUIDE.md`
  - `server/scripts/generateUserGuide.js`
- Verification: Documents generated cleanly; test suite passed (82/82); build verified.

## Documentation acceptance - 16 October 2026

- Scope: D001 and D002; decision.md, flow.md and AGENTS.md.
- Quiz answers: reasons for choosing a library or approach belong in decision.md; the agent must wait for quiz answers and explicit acceptance.
- User explicitly accepted the documentation changes with "yes" after the quiz.
- This acceptance does not approve other pending code changes or authorize a commit, push or deployment.