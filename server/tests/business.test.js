import test from "node:test";
import assert from "node:assert/strict";
import { financialYear } from "../services/sequenceService.js";
import {
  calculateTrip,
  selectRate,
} from "../services/tripCalculationService.js";
import {
  calculateInvoice,
  amountInWords,
  paymentState,
} from "../services/invoiceCalculationService.js";
import {
  validateRows,
  detectMapping,
  parseWorkbook,
} from "../services/excelImportService.js";
import {
  masterSchemas,
  paymentSchema,
  tripSchema,
} from "../validators/index.js";
import { roles } from "../middleware/auth.js";
const base = {
  routeId: "route",
  vehicleType: "17 FT",
  minKm: 0,
  maxKm: 50,
  minExclusive: false,
  active: true,
  baseHours: 12,
  baseRate: 4000,
  perKmRate: 40,
  perHourRate: 350,
  overtimeRate: 250,
  billingMethod: "Fixed + Overtime",
  effectiveFrom: "2026-01-01",
};
const input = {
  routeId: "route",
  vehicleType: "17 FT",
  periodFrom: "2026-10-07",
  distanceKm: 42,
  totalHours: 12,
  extraAmount: 0,
  deductionAmount: 0,
};
for (const [d, fy] of [
  ["2026-10-07", "2026-27"],
  ["2027-02-01", "2026-27"],
  ["2027-04-01", "2027-28"],
  ["2027-03-31T18:29:00Z", "2026-27"],
  ["2027-03-31T18:30:00Z", "2027-28"],
])
  test("financial year " + d, () => assert.equal(financialYear(d), fy));
const slabs = [
  base,
  { ...base, minKm: 50, maxKm: 150, minExclusive: true },
  { ...base, minKm: 150, maxKm: null, minExclusive: true },
];
for (const [distance, index] of [
  [0, 0],
  [50, 0],
  [50.01, 1],
  [150, 1],
  [150.01, 2],
])
  test("distance boundary " + distance, () =>
    assert.equal(
      selectRate(slabs, { ...input, distanceKm: distance }).minKm,
      slabs[index].minKm,
    ),
  );
test("ambiguous rate rejected", () =>
  assert.throws(() => selectRate([base, base], input), /Overlapping/));
test("expired rate rejected", () =>
  assert.throws(
    () => selectRate([{ ...base, effectiveTo: "2026-09-30" }], input),
    /No applicable/,
  ));
test("12 hours included", () =>
  assert.equal(calculateTrip(input, base).totalAmount, 4000));
test("15 hours overtime", () => {
  const c = calculateTrip({ ...input, totalHours: 15 }, base);
  assert.equal(c.overtimeHours, 3);
  assert.equal(c.overtimeAmount, 750);
  assert.equal(c.totalAmount, 4750);
});
test("per KM", () =>
  assert.equal(
    calculateTrip(input, { ...base, billingMethod: "Per KM" }).totalAmount,
    1680,
  ));
test("per hour", () =>
  assert.equal(
    calculateTrip(input, { ...base, billingMethod: "Per Hour" }).totalAmount,
    4200,
  ));
test("fixed trip ignores overtime", () =>
  assert.equal(
    calculateTrip(
      { ...input, totalHours: 15 },
      { ...base, billingMethod: "Fixed Trip Rate" },
    ).totalAmount,
    4000,
  ));
test("manual agreement", () =>
  assert.equal(
    calculateTrip(
      { ...input, manualAmount: 5250, overrideReason: "Agreed with customer" },
      { ...base, billingMethod: "Mutually Agreed / Manual" },
    ).totalAmount,
    5250,
  ));
test("manual requires reason", () =>
  assert.throws(
    () =>
      calculateTrip(
        { ...input, manualAmount: 5250 },
        { ...base, billingMethod: "Mutually Agreed / Manual" },
      ),
    /reason/,
  ));
test("override and adjustments", () => {
  const c = calculateTrip(
    {
      ...input,
      overrideAmount: 4500,
      overrideReason: "Agreement",
      extraAmount: 100,
      deductionAmount: 50,
    },
    base,
  );
  assert.equal(c.originalCalculatedRate, 4000);
  assert.equal(c.finalRate, 4500);
  assert.equal(c.totalAmount, 4550);
});
test("negative distance rejected", () =>
  assert.throws(() => calculateTrip({ ...input, distanceKm: -1 }, base)));
test("excess deduction rejected", () =>
  assert.throws(() =>
    calculateTrip({ ...input, deductionAmount: 5000 }, base),
  ));
test("decimal money rounding", () =>
  assert.equal(
    calculateTrip(
      { ...input, distanceKm: 0.1 },
      { ...base, billingMethod: "Per KM", perKmRate: 0.3 },
    ).totalAmount,
    0.03,
  ));
test("intrastate GST", () => {
  const c = calculateInvoice(
    4000,
    {
      stateCode: "27",
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 0,
      roundToRupee: true,
    },
    "27",
  );
  assert.equal(c.totalAmount, 4720);
  assert.equal(c.cgstAmount, 360);
});
test("interstate GST", () =>
  assert.equal(
    calculateInvoice(
      4000,
      { stateCode: "24", cgstRate: 0, sgstRate: 0, igstRate: 18 },
      "27",
    ).totalAmount,
    4720,
  ));
test("mixed GST rejected", () =>
  assert.throws(() =>
    calculateInvoice(
      4000,
      { stateCode: "24", cgstRate: 9, sgstRate: 9, igstRate: 18 },
      "27",
    ),
  ));
test("round off", () => {
  const c = calculateInvoice(
    100.49,
    {
      stateCode: "27",
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      roundToRupee: true,
    },
    "27",
  );
  assert.equal(c.totalAmount, 100);
  assert.equal(c.roundOff, -0.49);
});
test("partial payment state", () =>
  assert.equal(paymentState(50000, 20000, "2099-01-01"), "Partially Paid"));
test("full payment state", () =>
  assert.equal(paymentState(50000, 50000, "2026-01-01"), "Paid"));
test("overdue state", () =>
  assert.equal(paymentState(50000, 0, "2020-01-01"), "Overdue"));
test("Indian amount words", () =>
  assert.equal(
    amountInWords(150000.25),
    "Rupees One Lakh Fifty Thousand and Twenty Five Paise Only",
  ));
test("header aliases", () =>
  assert.equal(
    detectMapping(["Vehicle No", "CHA NAME", "Total Hrs"]).vehicleNo,
    "Vehicle No",
  ));
test("invalid import rows and vehicle mismatch", () => {
  const r = validateRows(
    [
      { DATE: "2026-10-07", Vehicle: "MH02AB1234", Hours: 15 },
      { DATE: "2026-02-30", Vehicle: "OTHER", Hours: -2 },
    ],
    { date: "DATE", vehicleNo: "Vehicle", totalHours: "Hours" },
    {
      periodFrom: "2026-10-01",
      periodTo: "2026-10-31",
      vehicleNumber: "MH 02 AB 1234",
    },
  );
  assert.equal(r[0].status, "Valid");
  assert.equal(r[1].status, "Invalid");
  assert.ok(r[1].errors.length >= 2);
});
test("vehicle canonicalization", () =>
  assert.equal(
    masterSchemas.vehicles.parse({
      vehicleNumber: "mh 02 ab 1234",
      vehicleType: "17 FT",
    }).vehicleNumber,
    "MH02AB1234",
  ));
test("negative payment rejected", () =>
  assert.equal(
    paymentSchema.safeParse({
      invoiceId: "a".repeat(24),
      paymentDate: "2026-10-07",
      amount: -1,
      paymentMode: "Cash",
    }).success,
    false,
  ));
test("role enforced on backend", () => {
  let err;
  roles("ADMIN")({ user: { role: "MANAGER" } }, {}, (e) => (err = e));
  assert.equal(err.status, 403);
  let accepted = false;
  roles("ADMIN")({ user: { role: "ADMIN" } }, {}, () => (accepted = true));
  assert.equal(accepted, true);
});
test("overdue follows Indian midnight", () => {
  assert.equal(
    paymentState(100, 0, "2026-10-07", "2026-10-07T18:29:00Z"),
    "Pending",
  );
  assert.equal(
    paymentState(100, 0, "2026-10-07", "2026-10-07T18:30:00Z"),
    "Overdue",
  );
});
