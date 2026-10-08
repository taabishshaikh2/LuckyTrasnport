# Site billing workflow

Sites: Inbound (MIDC to Cargo), Outbound (Marwah to Cargo), Goregaon to Cargo, Vidhyavihar/VVR to Cargo.

All four site templates have the same 16 owner-specified business columns. Their worksheet names and site filters differ. Extra challan/closing-date references and original duty records are separate supporting worksheets. Exports of all sites contain individual site tabs.

## Setup

1. Add customer, vehicles, routes and effective adhoc rates. Included duty is configurable per rate; no site-specific hours or unconfirmed tariffs are automatically imposed.
2. For branded billing, an administrator adds one vehicle agreement covering the invoice period in More > Vehicle agreements. Record shift hours, monthly KM, fixed per-KM rate, agreed mileage/fuel rate, and applicable additional service, AMC, management, parking and airport-entry charges. Create dated agreement versions when rates change; end the previous version before adding an overlapping version. Old issued invoices retain their snapshots.
3. Import or enter duty records under the correct site and Adhoc/Branded duty type. Assign a driver for submission and follow approval/completion. Variable invoices accumulate eligible branded records per vehicle; reviewed period inputs with a reason can supply missing records or override quantities.
4. Select Fixed, Variable or Adhoc in invoice creation. Review vehicle-wise narration, GST configuration, reimbursement classifications and period-charge allocations before issuing. Download the PDF/DOCX package and supporting Excel from the issued invoice.

## Confirmed rules

- One challan is one trip. Distinct continuation rows with the same explicit challan number and vehicle become one trip with multiple duty records and one base charge. Identical repeated rows are skipped. A HU/AWB alone does not automatically establish a challan identity.
- Duty begins at pickup arrival. Enter closing dates for multi-day duty. HH:mm represents hours/minutes; overtime uses actual minutes at the configured hourly rate.
- Fixed and Variable are separate billing components for the same fleet. Fixed billing does not require completed trips. Fleet billing covers one calendar month or a selected range within it; separate months are billed separately.
- Partial-period fixed, management and parking allocations require explicit fractions and a reason. Applicable monthly fractions cannot exceed 100% across issued invoices. Other period charges require an allocation note. The owner's final monthly-pass/parking/management split rule is still pending; it is not guessed.
- Fuel and additional-service line amounts round per vehicle to rupees; AMC rounds upward, matching the supplied examples. Final GST and invoice rounding are reviewed separately. Fuel/shift quantities retain their full source precision, including hidden Excel decimals.
- Airport-entry tax treatment is configurable per agreement and is shown separately where non-taxable. Confirm classifications with the business before issuance.
- Issued invoices snapshot line items, agreements, company details and supporting trips. Billing claims prevent overlapping invoice components, including concurrent requests. Cancellation releases claims only when no payment has been recorded.

Supporting agreements, challans, receipts, cash memos and other annexures are attached by the owner after the main package is generated.

## Validation

Reference checks cover G092 fixed: taxable 386400, payable 455952; G089 variable: taxable 143767, other reimbursement 12750, payable 182395; G101: 287h57m overtime at 200/hour = 57590. Original workbook parsing was exercised across 30 operational worksheets in the three supplied files. Ambiguous 12-hour clock values and mismatches remain visible for review; do not assume they have been resolved by these examples.


## Simplified fleet billing
Use Rate chart → Fixed & variable rates, then assign the vehicle under Vehicle shifts. The shift maps to 3,000/4,000/5,000 monthly KM for 8/16/24 hours.
Fuel charges stores vehicle mileage and the fuel rate for a dated period. Toll, entry & parking and Airport reimbursement are separate dated expense pages.
Variable invoices read approved branded trips, sum SDC charges and KM, calculate fuel, and calculate additional services from exact excess duty minutes / 480 × the per-8-hour shift rate. Full-month included duty is 26 × the assigned shift; shorter periods prorate the allowance by calendar days. Negative excess becomes zero.
Source trip toll columns remain available for import/export but are not billed a second time; record expenses once on the expense page. Airport reimbursements are always non-taxable and added after GST. Fixed invoices contain only contracted KM × rate plus GST. Partial periods prorate contracted KM by calendar days, visible in the review.
Existing issued invoices keep their snapshots; older agreement data is retained. To use the simplified pages, edit an existing Vehicle shift and select a matching new rate chart.
