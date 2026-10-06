# Lucky Transport App — Phase 1

Mobile-first transport operations and billing for Lucky Transport Services, Mumbai. This source implementation covers fleet and driver masters, customers, configurable routes/rates, manual trips and challan entries, reviewed Excel imports, invoice generation, authenticated PDF/DOCX/XLSX downloads, payment history and outstanding balances.

The build is provisional until validated against the real challan, rate chart and invoice. Seed rates are illustrative. Do not use them for actual billing.

## Architecture

React/Vite/React Router/Axios/Lucide client, Express REST server, MongoDB/Mongoose, JWT/bcrypt, backend role authorization. Decimal.js calculates money. Atomic counters create human-readable identifiers. Transactions protect invoice creation, import confirmation and payment posting. Archived/cancelled records preserve history. Read [the architecture and schema design](docs/ARCHITECTURE.md) before modifying financial workflows.

```
client/src/  api, components, features, hooks, layouts, pages
server/     config, middleware, models, routes, services, utils, validators, tests
docs/       design and verification notes
render.yaml deployment blueprint
.env.example configuration template
```

## Local installation

Use Node 22.12+ and npm. From this directory:

```powershell
npm ci
Copy-Item .env.example server/.env
```

Edit `server/.env`: set an Atlas connection string, a random JWT secret of at least 32 characters, company details and frontend origin. Keep the file out of version control. For local MongoDB, use a replica set; standalone MongoDB cannot run the required transactions.

```powershell
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 3001. No database-free demo or fake API is provided.

## MongoDB Atlas

Create a free Atlas cluster and a database user restricted to this database. Add the development IP and the Render service's outbound IP ranges to Network Access. Use the driver's `mongodb+srv` connection string, including a database name and URL-encoded password. Atlas supports the transactions required by this app. Indexes initialize during server startup; startup fails if existing data conflicts with a unique index.

## Development seed

Set `ALLOW_DEV_SEED=true` and `NODE_ENV=development` against a development database, then:

```powershell
npm run seed
```

Seed adds missing sample masters and users, preserves existing records/passwords, and never drops collections. It creates 4 vehicles, 3 drivers, 4 customers including DHL Express, 5 routes and illustrative rate rules. Accounts: `admin / admin123`, `manager / manager123`, `driver1 / driver123`. Driver login is linked to its assigned driver record. Change these credentials before production. Production user management requires passwords of at least 10 characters. Disable the seed opt-in afterward.

## Build and tests

```powershell
npm test
npm run test:integration
npm run build
npm start
```

The server serves `client/dist` and uses SPA fallback for React routes. Health: `GET /api/health`. Successful API responses use `{success:true,data}`; errors use `{success:false,message,errors:[]}`.

## Configuration

`MONGODB_URI` and `JWT_SECRET` are required. `JWT_EXPIRES_IN` defaults to 8h. `PORT` defaults to 3001. `FRONTEND_URL` is a comma-separated exact-origin allowlist. `NODE_ENV=production` blocks development seeding. All `COMPANY_*` values are documented in `.env.example`; fill address, phone, email, GSTIN, PAN, state and banking information before issuing invoices. Company details are frozen on each invoice. `COMPANY_STATE_CODE` defaults provisionally to Maharashtra 27. For separately hosted clients, set `VITE_API_URL` at build time to the backend `/api` URL; never put secrets in Vite variables.

## Roles

Admin manages users and route/rate configuration, plus all operations. Manager manages vehicles, drivers, customers, trips, invoices and payments, and reads configured routes/rates. Driver reads only its assigned trips. Server checks roles on every protected route. Tokens live in session storage and expire; sign-out clears the local token. User inactivity and role changes are checked against the database on every request.

## Excel import

Upload an xlsx/xls worksheet (5 MB, up to 2,000 rows, 100 columns), select a worksheet or leave blank for the first, review detected header aliases, and map columns. Date is required; use Excel dates or ISO `YYYY-MM-DD`. Times use Excel time fractions or `HH:mm`. Select the trip customer, vehicle, driver, route and billing period. Rows from another vehicle or outside that period are invalid. Duty hours and distance are summed from accepted entries. Review errors, warnings and the charge explanation, then explicitly confirm. Valid/warning rows are imported into a single trip; invalid rows are counted and excluded. Import batches retain filename, original rows, mapping, actor, fingerprint and successful/failed counts. Confirmation is transactional and cannot run twice. Duplicate files are rejected. Separate multi-vehicle or multi-customer worksheets before uploading. Formula cells require cached results from Excel. GT amounts are retained as source fields and do not silently add to billing.

## Trip and invoice workflow

Configure non-overlapping rate rules, including explicit slab inclusivity and effective dates. Create a trip using Assignment → Duty → Review. Server calculates fixed, per-KM, per-hour, fixed-plus-overtime or manually agreed amounts. Manual amounts and overrides require reasons. Save Draft or Submit; only drafts can be edited. Submit → Approve → Complete. Operational completion is separate from invoicing. Submitted/approved open trips reserve their fleet and driver; maintenance, inactive and leave flags are preserved.

Create an invoice from approved/completed trips for one customer. Verify place-of-supply state and GST rates, review the server calculation, then issue. Rates start at zero to require a deliberate decision. CGST/SGST and IGST are mutually exclusive. Indian fiscal-year sequence resets April 1. Finalized invoices cannot be edited. Cancellation requires a reason, preserves history and releases selected trips; cancellation with received payments is blocked pending a future credit/reversal workflow. Payment modes include cash, bank transfer, UPI, cheque and other. Each partial payment remains a separate record; overpayment is blocked, including concurrent posts. Customers' totals are derived from invoices/payments plus opening balance.

Invoice detail provides PDF, DOCX and supporting Excel. Trip detail provides XLSX and landscape DOCX. Reports export date/customer/vehicle/route filters and show customer balances. Protected downloads send the JWT with Axios and revoke object URLs. The current invoice/trip templates await the real company examples.

## Render deployment

Push this directory as the repository root. Create the web service with the included blueprint, or configure `npm ci && npm run build` and `npm start`. Set `NODE_ENV=production`, Atlas `MONGODB_URI`, a generated `JWT_SECRET`, `FRONTEND_URL=https://your-service.onrender.com` and all company variables. Render supplies `PORT`. Configure Atlas network access for Render outbound ranges. The single service hosts both SPA and API, so no source edits are needed. Check `/api/health`, sign in with a provisioned administrator and run the operational acceptance workflow before live billing. Do not run development seed on the production service. Provision the first production administrator with `npm run bootstrap --workspace server`, using temporary process environment variables `BOOTSTRAP_USERNAME`, `BOOTSTRAP_PASSWORD` (12+ characters) and optional `BOOTSTRAP_NAME`. The command refuses to run if an active Admin already exists. Clear the bootstrap password afterward.

## Troubleshooting and current boundaries

Database connection failure: verify Atlas IP rules, credentials and database name. Transaction errors: use Atlas or a replica set. No rate found: check route/type/date/slab; overlapping rules are rejected. Auth download failures: sign in again and retry. Blank deep links: ensure the frontend build completed and use the provided server SPA fallback. CORS failures: exact origins, no trailing slash. Exports/list screens currently cap at 2,000 records; keep operational filters bounded and add pagination before larger deployments. Imported hours are explicit; overnight/MRB/GT arithmetic awaits real documents. Production release requires Atlas/Render validation, staff acceptance, backups and reconciliation against real company documents. Integration tests use a disposable local replica set; the first run downloads MongoDB from its official distribution. See [verification status](docs/VERIFICATION.md).
