import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { combineGstRows, gstColumns } from "../../shared/gst.js";
import { parseGstWorkbook, gstWorkbook } from "../services/gstService.js";
test("GST invoice rows use saved amounts, omit cancelled invoices and deduplicate imported bills", () => {
  const invoice = {
    _id: "1",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-10-01",
    invoicedTo: "DHL",
    gstin: "27ABCDE1234F1Z5",
    baseAmount: 10000,
    nonTaxableAmount: 500,
    cgstAmount: 900,
    sgstAmount: 900,
    totalAmount: 12300,
    status: "Pending",
    description: "Inbound",
    location: "MIDC",
  };
  const rows = combineGstRows(
    [
      invoice,
      { ...invoice, _id: "2", invoiceNumber: "INV-2", status: "Cancelled" },
    ],
    [
      { billNumber: " inv-1 ", billDate: "2026-10-01" },
      { billNumber: "INV-2", billDate: "2026-10-01" },
    ],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].taxableValue, 10000);
  assert.equal(rows[0].toll, 500);
  assert.equal(rows[0].totalAmount, 10500);
  assert.equal(rows[0].cgstAmount, 900);
  assert.equal(rows[0].customerName, "DHL");
});
test("GST sample and exported amounts round trip with exact column order", () => {
  const sample = parseGstWorkbook(gstWorkbook([], true));
  assert.equal(sample.errors.length, 0);
  assert.equal(sample.rows.length, 1);
  assert.equal(sample.rows[0].billDate, "2026-10-01");
  const row = { ...sample.rows[0], srNo: 1 };
  const buffer = gstWorkbook([row]);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  assert.deepEqual(
    grid[0],
    gstColumns.map((c) => c[0]),
  );
  const parsed = parseGstWorkbook(buffer);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].totalAmount, 10500);
});
test("GST import rejects invalid dates, totals, tax types and duplicate bills before saving", () => {
  const wb = XLSX.read(gstWorkbook([], true), { type: "buffer" }),
    sheet = wb.Sheets[wb.SheetNames[0]];
  sheet.D2.v = "31-02-2026";
  sheet.J2.v = 999;
  sheet.K2.v = 1800;
  const parsed = parseGstWorkbook(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
  );
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.errors[0].message, /Invalid bill date/);
  assert.match(parsed.errors[0].message, /Total amount/);
  assert.match(parsed.errors[0].message, /not both/);
  const book = XLSX.utils.book_new();
  const data = XLSX.utils.sheet_to_json(
    XLSX.read(gstWorkbook([], true), { type: "buffer" }).Sheets["GST records"],
    { header: 1 },
  );
  data.push(data[1]);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), "GST");
  const duplicate = parseGstWorkbook(
    XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
  );
  assert.equal(duplicate.errors.length, 1);
  assert.match(duplicate.errors[0].message, /Duplicate/);
});
