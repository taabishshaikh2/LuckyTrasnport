# Execution flow

Source baseline inspected: 16 October 2026. Paths are relative to the repository root. This is a map of the main paths, not an exhaustive call graph. Branches below are alternatives, not calls that always all execute.

## 1. Process entry points

- Root package.json: `npm run dev` launches client and server workspace dev scripts concurrently.
- Client dev: Vite serves client/index.html. Its module script loads client/src/main.jsx.
- Production: `npm run build` creates client/dist; `npm start` launches server/index.js. server/app.js serves that build after API routing.
- Standalone reminders: `npm run reminders --workspace server` launches server/runExpiryReminders.js independently of the web listener.

## 2. Server startup order

server/index.js imports app.js and supporting modules (module initialization runs before the entry body).

1. config/env.js loads environment; validateEnv() checks required settings.
2. mongoose.connect() opens MongoDB.
3. Legacy invoice tripIds index is inspected and, when necessary, removed.
4. Registered models from server/models/index.js initialize their indexes with model.init().
5. startReminderScheduler() starts its immediate check and 15-minute timer. Its asynchronous work is not awaited before listening.
6. app.listen() starts HTTP service.
7. SIGTERM/SIGINT closes the listener, stops the scheduler, disconnects MongoDB and exits.

## 3. Request pipeline

server/app.js installs: Helmet -> CORS -> JSON body parsing -> /api apiLimit and safeInput.

- /api/health reports database readiness; /api/auth is handled before the general authentication gate.
- Other /api requests pass middleware/auth.js auth(), then the selected route's operations/admin permission checks and input validation.
- Routes invoke services; services use models/index.js for database reads/writes. transactionService.js transaction() wraps writes requiring atomicity.
- utils/errors.js wrap() forwards asynchronous failures to errorHandler(); ok() produces success responses. errorHandler is installed last.
- Unknown API paths become a safe 404. Non-API requests use static files or the client index.html fallback.

## 4. Browser startup and API access

client/index.html -> main.jsx -> createRoot() -> BrowserRouter -> App().

- App checks sessionStorage for a token. With a token, api.get('/auth/me') restores the user; failure logs out.
- Without a user, Login renders; submit() posts /auth/login, saves the token and updates App state. PasswordRecovery is a separate recovery branch.
- Authenticated routes render layouts/Shell.jsx and the selected page. Role checks hide restricted pages; server middleware independently enforces access.
- api/client.js owns HTTP authentication/error handling; hooks/useData.js handles reusable loading. Page forms use their submit handlers for mutations and reload or navigate after success.

## 5. Adhoc trip review and save

main.jsx /trips/new -> features/AdhocTripForm.jsx.

1. Form state collects route/site, vehicle, timing and service-band inputs; multi-day entry includes the closing date.
2. review() -> POST /api/trips/preview -> routes/trips.js validation -> tripService.js previewTrip().
3. previewTrip() resolves referenced records, normalizes duty using dutyTimeService.js pickupDuty(), and selects the applicable city/KM or legacy rate path. adhocRateService.js, distanceRateService.js and tripCalculationService.js contain the relevant rate/calculation helpers.
4. The browser displays the returned calculation.
5. save(status) sends POST /api/trips or PATCH /api/trips/:id, including expectedTotal from the preview. Server validation/calculation and billed-record guards remain authoritative; a browser preview is not trusted as the final amount.
6. Creation uses tripService.js createTrip(); the route persists changes with its transaction/audit handling. The browser navigates to /trips/:id.
7. pages/Trips.jsx dispatches lists/details; TripTable/AdhocTripTable and shared/adhoc.js supply the displayed rows. Export requests instead go through routes/exports.js and excelExportService.js.

## 6. Invoice and payment branch

pages/Invoices.jsx / features/BillingInvoiceForm.jsx -> routes/invoices.js.

- prepare() loads the billing customer and branches by billingType: Adhoc selects approved/completed trips; fleet billing invokes fleetBillingService.js prepareFleet() and its applicable billing service.
- Lines -> totalLines() -> invoiceCalculationService.js calculateInvoice() for tax/rounding. Customer/company/trip snapshots and reviewHash() produce the review result.
- Issue requests re-prepare and check reviewed data; transaction/billing claims protect against duplicate billing. Saved invoice snapshots preserve issued amounts.
- Payment requests use paymentService.js recordPayment(); invoiceBalance() supplies received/outstanding values.
- routes/exports.js dispatches output generation to Excel, PDF or DOCX services rather than recalculating invoice history from current vehicle settings.

## 7. GST read/import/export branch

pages/Gst.jsx -> routes/gst.js (operations permission).

- records(query) validates dates -> loads Invoice, GstRecord and Payment -> shared/gst.js combineGstRows() -> API rows. Invoice bill keys suppress duplicate imported rows.
- Export uses the same record mapping -> gstService.js gstWorkbook().
- Import parses the uploaded workbook using parseGstWorkbook(), validates/previews rows and confirms accepted historical records. These are GstRecord entries, not new invoices.

## 8. Vehicle expiry and Settings branch

- Vehicle master forms -> features/masterConfig.js -> routes/masters.js -> validators/index.js -> Vehicle model. Checked insurance/PUC requires an expiry date.
- pages/Home.jsx -> features/ExpiryAlerts.jsx -> routes/reminders.js alerts -> expiryReminderService.js getExpiryAlerts() -> shared/vehicleExpiry.js date/window rules. This works independently of email enablement.
- pages/Settings.jsx -> ReminderSettings.jsx -> reminders settings endpoints (admin-only); ShiftSettings.jsx -> /api/settings/shifts -> shiftSettingsService.js, ShiftSettings model and Audit.
- Scheduler tick() -> runExpiryReminders() -> settings/config checks -> eligible vehicle documents -> per-document/day/recipient delivery claim -> recheck current eligibility -> sendReminderEmail() -> Resend -> delivery state update. Failures are handled without making trip/vehicle saves depend on email.
- The standalone reminder entry connects to MongoDB and invokes the same worker. No GitHub Actions workflow or external trigger endpoint is configured in this baseline. A sleeping web process cannot run its timer.

## Maintenance checklist

When changing a path, update its entry point, caller/callee names, permission/validation boundaries, persistence and side effects here. Add the reason and tradeoff to decision.md. Complete the user quiz before marking the change accepted.
