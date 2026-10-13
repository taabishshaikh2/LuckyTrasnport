import XLSX from "xlsx";
import { z } from "zod";
import { gstColumns, gstMoneyKeys, billKey } from "../../shared/gst.js";
const text = z.string().trim().max(500),
  money = z.number().finite().min(0).max(1e12);
export const gstRecordSchema = z
  .object({
    customerName: text.min(1),
    customerGstin: text.max(15),
    billDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
        "Invalid bill date",
      ),
    billNumber: text.min(1).max(100),
    location: text,
    serviceDescription: text,
    ...Object.fromEntries(gstMoneyKeys.map((k) => [k, money])),
  })
  .superRefine((r, ctx) => {
    if (Math.abs(r.totalAmount - r.taxableValue - r.toll) > 0.011)
      ctx.addIssue({
        code: "custom",
        message: "Total amount must equal taxable value plus toll (before GST)",
      });
    if (r.igstAmount && (r.cgstAmount || r.sgstAmount))
      ctx.addIssue({
        code: "custom",
        message: "Use IGST or CGST/SGST, not both",
      });
    if (Math.abs(r.cgstAmount - r.sgstAmount) > 0.011)
      ctx.addIssue({
        code: "custom",
        message: "CGST and SGST amounts must match",
      });
  });
function dateValue(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d
      ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
      : "";
  }
  const s = String(v || "").trim(),
    match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : s;
}
const norm = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
export function parseGstWorkbook(buffer) {
  const book = XLSX.read(buffer, { type: "buffer", cellDates: true }),
    rows = [],
    errors = [],
    seen = new Set();
  for (const sheet of book.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(book.Sheets[sheet], {
      header: 1,
      defval: "",
    });
    const header = grid.findIndex(
      (r) =>
        r.some((c) => norm(c) === "BILLNO") &&
        r.some((c) => norm(c) === "CUSTOMERNAME"),
    );
    if (header < 0) continue;
    const indexes = Object.fromEntries(
      gstColumns
        .slice(1)
        .map(([label, key]) => [
          key,
          grid[header].findIndex(
            (c) =>
              norm(c) === norm(label) ||
              (key === "serviceDescription" &&
                norm(c).startsWith("TYPEOFSERVICES")),
          ),
        ]),
    );
    const missing = Object.entries(indexes).filter(
      ([key, index]) => index < 0 && key !== "sgstAmount",
    );
    if (missing.length) {
      errors.push({
        sheet,
        row: header + 1,
        message:
          "Missing columns: " +
          missing
            .map(([key]) => gstColumns.find((c) => c[1] === key)[0])
            .join(", "),
      });
      continue;
    }
    for (let i = header + 1; i < grid.length; i++) {
      const cells = grid[i];
      if (!cells.some((v) => v !== "")) continue;
      const raw = Object.fromEntries(
        Object.entries(indexes).map(([key, index]) => [
          key,
          key === "billDate"
            ? dateValue(cells[index])
            : gstMoneyKeys.includes(key)
              ? Number(String(cells[index] ?? 0).replace(/,/g, "") || 0)
              : String(cells[index] ?? "").trim(),
        ]),
      );
      if (
        !raw.billNumber &&
        cells.some((c) => norm(c) === "TOTAL" || norm(c) === "TOTALAMOUNT")
      )
        continue;
      if (indexes.sgstAmount < 0) raw.sgstAmount = raw.cgstAmount;
      const parsed = gstRecordSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({
          sheet,
          row: i + 1,
          message: parsed.error.issues
            .map(
              (e) =>
                (e.path.join(".") ? e.path.join(".") + ": " : "") + e.message,
            )
            .join("; "),
        });
        continue;
      }
      const key = billKey(raw.billNumber);
      if (seen.has(key)) {
        errors.push({
          sheet,
          row: i + 1,
          message: "Duplicate bill number in file",
        });
        continue;
      }
      seen.add(key);
      rows.push({ ...parsed.data, billKey: key });
      if (rows.length > 5000)
        throw new Error("Import at most 5,000 records at a time");
    }
  }
  if (!rows.length && !errors.length)
    errors.push({
      sheet: "",
      row: 0,
      message: "No GST records found. Use the sample Excel format",
    });
  return { rows, errors };
}
export function gstWorkbook(rows, sample = false) {
  const data = [
    gstColumns.map((c) => c[0]),
    ...(sample
      ? [
          [
            1,
            "Sample customer",
            "27ABCDE1234F1Z5",
            "2026-10-01",
            "SAMPLE-001",
            "Mumbai",
            "Transport services",
            10000,
            500,
            10500,
            0,
            900,
            900,
          ],
        ]
      : rows.map((r) => gstColumns.map(([, key]) => r[key] ?? ""))),
  ];
  if (!sample && rows.length)
    data.push(
      gstColumns.map(([, key], index) =>
        index === 0
          ? "TOTAL"
          : gstMoneyKeys.includes(key)
            ? Math.round(
                rows.reduce((sum, r) => sum + Number(r[key] || 0), 0) * 100,
              ) / 100
            : "",
      ),
    );
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = gstColumns.map(([, key]) => ({
    wch:
      key === "customerName"
        ? 38
        : key === "serviceDescription"
          ? 55
          : key === "location"
            ? 25
            : 18,
  }));
  for (const address of Object.keys(sheet))
    if (
      !address.startsWith("!") &&
      sheet[address].t === "n" &&
      XLSX.utils.decode_cell(address).c >= 7
    )
      sheet[address].z = "#,##0.00";
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "GST records");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}
