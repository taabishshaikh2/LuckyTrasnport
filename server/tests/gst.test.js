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

test("GST payments include multiple receipts, latest date and signed round off", () => {
  const invoice = {
    _id: "p1",
    invoiceNumber: "P1",
    invoicedTo: "Payment QA",
    invoiceDate: "2026-10-01",
    baseAmount: 100,
    nonTaxableAmount: 0,
    cgstAmount: 9,
    sgstAmount: 9,
    roundOff: -0.22,
    totalAmount: 117.78,
  };
  const payments = [
    {
      invoiceId: "p1",
      paymentDate: "2026-10-15",
      amount: 20,
      paymentMode: "NEFT",
      referenceNumber: "REF2",
    },
    {
      invoiceId: "p1",
      paymentDate: "2026-10-10",
      amount: 80,
      paymentMode: "NEFT",
      referenceNumber: "REF1",
    },
    { invoiceId: "other", paymentDate: "2026-10-20", amount: 10 },
  ];
  const [row] = combineGstRows([invoice], [], payments);
  assert.equal(row.roundOff, -0.22);
  assert.equal(row.totalBillAmount, 117.78);
  assert.equal(row.receivedAmount, 100);
  assert.equal(row.differenceTds, 17.78);
  assert.equal(row.receiveDate, "2026-10-15");
  assert.ok(
    row.paymentDetails.indexOf("REF1") < row.paymentDetails.indexOf("REF2"),
  );
  const parsed = parseGstWorkbook(gstWorkbook([row]));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows[0].roundOff, -0.22);
  assert.equal(parsed.rows[0].receivedAmount, 100);
});
test("GST import reads bracketed round off and preserves legacy column files", () => {
  const book = XLSX.read(gstWorkbook([], true), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json(book.Sheets["GST records"], {
    header: 1,
  });
  grid[1][13] = "(0.22)";
  grid[1][14] = 12299.78;
  grid[1][18] = 299.78;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), "GST");
  const parsed = parseGstWorkbook(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
  );
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows[0].roundOff, -0.22);
  const legacy = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    legacy,
    XLSX.utils.aoa_to_sheet(grid.map((r) => r.slice(0, 13))),
    "GST",
  );
  const old = parseGstWorkbook(
    XLSX.write(legacy, { type: "buffer", bookType: "xlsx" }),
  );
  assert.equal(old.errors.length, 0);
  assert.equal(old.rows[0].totalBillAmount, 12300);
  assert.equal(old.rows[0].differenceTds, 12300);
});
