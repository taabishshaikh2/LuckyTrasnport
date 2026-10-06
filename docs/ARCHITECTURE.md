# Phase 1 design, before implementation

Workflow: configure fleet, drivers, customers, routes and dated rate rules; capture challans manually or import after mapping and validation; review authoritative server calculation; draft, submit, approve and complete; consolidate eligible trips into a GST invoice; retain payment history and derive outstanding; download protected Excel, PDF and DOCX documents.

## Project architecture

React + Vite + React Router + Axios + Lucide. Mobile cards, bottom navigation and step-based trip creation, desktop sidebar. Express REST API, JWT authentication, backend roles, Zod validation, Mongoose and MongoDB Atlas. Single Render web service serves the production SPA and API; local Vite proxies /api. No mock API or financial calculation in components.

## Schemas and relationships

All documents use ObjectId primary keys and timestamps. User: name, username, passwordHash, role, active, driverId. A Driver user must reference its Driver record and can only read assigned trips. Vehicle: vehicleId, unique normalized vehicleNumber, vehicleType, customVehicleType, capacity, status, notes, archived. Driver: driverId, fullName, phone, licenseNumber, licenseExpiry, age, experienceYears, address, status, assignedVehicleId -> Vehicle, notes, archived. Customer: customerId, companyName, contactPerson, phone, email, address, city, state, stateCode, gstin, dhlGstin, creditDays, openingBalance, active, notes, archived. Route: routeId, routeName, pickupLocation, dropLocation, category, order, active, notes, archived. Rate: rateId, routeId -> Route, vehicleType, minKm, maxKm, minExclusive, baseHours, baseRate, perKmRate, perHourRate, overtimeRate, billingMethod, effectiveFrom, effectiveTo, active, notes, archived.

Trip: tripId; customerId, vehicleId, driverId, routeId references; route and vehicle snapshots; period; distance, hours; array of challan entries (date, vehicleNo, chaName, times, perTripHours, totalHours, gtInHours, gtAmount, distance and locations); immutable applicable rate snapshot and calculation explanation; monetary summary; override audit; status; operationalCompleted; source; createdBy and updatedBy. Invoice: fiscal invoiceNumber, dates, customerId, tripIds, customer/address/GST snapshots, description, place-of-supply/state, SAC, billing period, GST rates and amounts, total, roundOff, amountInWords, status, payment aggregate guard, createdBy. Payment: paymentId, invoiceId, customerId, date, amount, mode, reference, notes, recordedBy. Counter: scope primary key and atomic value. ImportBatch: owned upload, original filename, rows, mapping, row counts, hash, completion metadata. Audit: entity, previous/new values, reason, changedBy and time.

Invoice and payment operations run in MongoDB transactions. A conditional invoice write serializes concurrent payment recording; payment records are authoritative and reconcile with a persisted guard used solely for atomic balance enforcement. A unique partial index on active invoice trip membership prevents double billing. Records are archived/cancelled; financial records have no delete API. Trip mutations are transactional and serialized against master archive operations using reference guard writes. Operational completion is separate from invoicing; availability follows current active trips, preserving Maintenance, Inactive and On Leave flags.

## Calculations

Backend services select active rates by route, vehicle type, date and distance. Explicit lower-bound inclusivity permits [0,50], (50,150], (150,infinity). Ambiguous overlapping rates fail visibly. Decimal.js handles money rounded to two decimal places. Fixed + Overtime includes base hours; Per KM and Per Hour use corresponding measures; Manual requires agreed amount and reason. Rate overrides preserve original and final amounts and actor. Server preview and commit run the same engine; submitted changes require a fresh preview and final amount match.

## Imports

Authenticated bounded upload accepts xlsx/xls, parses a selected sheet, detects header aliases and offers configurable mapping. Server retains upload rows with owner and fingerprint. Preview validates each mapped row, references, date/time and numbers; warnings differ from blocking errors. Confirm revalidates, creates one trip with valid challan entries, records failed rows and metadata in the same transaction, and cannot confirm twice. Duplicate file imports are blocked. Real workbook grouping semantics are provisional: one upload corresponds to one header/period trip. Formula cells without cached results must be corrected before import.

## Invoices and documents

Eligible approved/completed trips must belong to the same customer and be uninvoiced. Server creates frozen totals and customer/company snapshots, fiscal-year atomic number (Asia/Kolkata dates), mutually exclusive CGST/SGST or IGST based on supplied state code, and amount in words. Tax rates require user confirmation; no legal tax defaults inferred. PDFKit and docx render server documents; SheetJS formats trip exports. Downloads use bearer-authenticated Axios blobs. Cancellation requires a reason and no received payments, preserves history and releases trip billing eligibility.

## Screens

Login, Home, Vehicles, Drivers, Customers, Routes, Rates, Trips, Invoices, Payments, Reports, Settings and admin Users. Entity list cards open details and edit forms. Trips use Assignment -> Duty -> Review; detail includes entry editor and audit calculation. Invoice creation selects customer/trips, tax rates and description; detail exposes downloads and partial-payment recording. Excel import uses upload -> mapping -> validation -> explicit confirmation. Every request exposes loading and errors.

## Provisional assumptions

Sample rates are illustrative and never operational defaults. Real challan columns, time arithmetic (particularly MRB/GT), monthly passes, groupings, invoice wording/layout, GST classification/rates and invoice revision rules await real company documents. Hours are explicit inputs; overnight time inference is not invented. Invoice SAC 996601 is provisional and editable. Company identifiers/banking must be configured. Production release requires real-document reconciliation, configured Atlas/Render, changed development credentials and live browser/operational acceptance testing.
