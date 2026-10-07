import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import {
  parseWorkbook,
  validateRows,
  durationHours,
  excelDate,
} from "../services/excelImportService.js";
import { pickupDuty } from "../services/dutyTimeService.js";
import {
  tripWorkbook,
  importTemplate,
  columns,
} from "../services/excelExportService.js";
test("printed hours.minutes and decimal duration are explicitly different", () => {
  assert.equal(durationHours("8.30", "hoursMinutes"), 8.5);
  assert.equal(durationHours("8.5", "decimal"), 8.5);
  assert.equal(durationHours("0:05", "hoursMinutes"), 5 / 60);
  assert.throws(() => durationHours("8.75", "hoursMinutes"));
});
test("historical dates accept Indian numeric and named months", () => {
  assert.equal(excelDate("03-Sep-25"), "2025-09-03");
  assert.equal(excelDate("03/09/2025"), "2025-09-03");
});
test("table beneath merged titles ignores summary and retains actual row numbers", () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([
      ["Lucky Transport"],
      ["Vendor", "Lucky"],
      [],
      ["Sr No", "Date", "Vehicle No", "Total Hrs", "O.T. In Hrs"],
      [1, "03-Sep-25", "MH01AB1234", "8.30", "0.30"],
      ["TOTAL AMT", "", "", "8.30"],
    ]),
    "Trips",
  );
  const p = parseWorkbook(XLSX.write(b, { type: "buffer", bookType: "xlsx" }));
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].__rowNumber, 5);
  assert.equal(p.mapping.srNo, "Sr No");
  const r = validateRows(p.rows, p.mapping, { durationFormat: "hoursMinutes" });
  assert.equal(r[0].data.totalHours, 8.5);
  assert.equal(r[0].data.gtInHours, 0.5);
});
test("pickup arrival to midnight and multi-day close use minutes", () => {
  assert.equal(
    pickupDuty({
      date: "2026-10-07",
      openingTime: "12:00",
      closingTime: "00:49",
    }).totalHours,
    769 / 60,
  );
  assert.equal(
    pickupDuty({
      date: "2026-10-07",
      openingTime: "12:00",
      closingTime: "12:00",
      closingDate: "2026-10-09",
    }).totalHours,
    48,
  );
  assert.throws(() =>
    pickupDuty({
      date: "2026-10-07",
      openingTime: "12:00",
      closingTime: "11:00",
      closingDate: "2026-10-07",
    }),
  );
});
test("export can be parsed again with every supplied sheet field", async () => {
  const t = {
    tripId: "TR-test",
    vehicleNumber: "MH01AB1234",
    vehicleType: "17 FT",
    status: "Draft",
    customerId: { companyName: "DHL" },
    baseAmount: 2657,
    overtimeAmount: 100,
    totalAmount: 2807,
    entries: [
      {
        date: "2026-10-07",
        challanNumber: "0003382",
        huNumber: "HU123",
        openingTime: "12:00",
        closingTime: "20:30",
        totalHours: 8.5,
        gtInHours: 0.5,
        tollParking: 50,
        tripCharges: 2657,
        gtAmount: 100,
        totalServiceCharges: 2807,
        overtimeKm: 2,
      },
    ],
  };
  const p = parseWorkbook(await tripWorkbook([t]));
  const r = validateRows(p.rows, p.mapping, {
    durationFormat: "hoursMinutes",
  })[0];
  assert.equal(r.data.challanNumber, "0003382");
  assert.equal(r.data.totalHours, 8.5);
  assert.equal(r.data.tollParking, 50);
  assert.equal(r.data.overtimeKm, 2);
  assert.equal(p.headers.length, columns.length + 6);
  assert.ok(importTemplate().length > 1000);
});
test("whole-number clock hours remain clock times", () => {
  const rows = validateRows(
    [{ Date: "2026-10-07", Opening: 12, Closing: 20 }],
    { date: "Date", openingTime: "Opening", closingTime: "Closing" },
  );
  assert.equal(rows[0].data.openingTime, "12:00");
  assert.equal(rows[0].data.closingTime, "20:00");
});
