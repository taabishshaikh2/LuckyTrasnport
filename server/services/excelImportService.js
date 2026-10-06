import XLSX from "xlsx";
import { entrySchema } from "../validators/index.js";
export const importFields = [
  "date",
  "vehicleNo",
  "chaName",
  "vehicleType",
  "openingTime",
  "mrbArrivalTime",
  "closingTime",
  "perTripHours",
  "totalHours",
  "gtInHours",
  "gtAmount",
  "distanceKm",
  "pickupLocation",
  "dropLocation",
  "remarks",
];
const aliases = {
  date: ["date", "tripdate"],
  vehicleNo: ["vehicleno", "vehiclenumber", "truckno"],
  chaName: ["chaname", "cha"],
  vehicleType: ["vehicletype", "type"],
  openingTime: ["openingtime", "starttime"],
  mrbArrivalTime: ["mrbarrivaltime", "arrival"],
  closingTime: ["closingtime", "endtime"],
  perTripHours: ["pertriphrs", "pertriphours"],
  totalHours: ["totalhrs", "totalhours", "hours"],
  gtInHours: ["gtinhrs", "gtinhours"],
  gtAmount: ["gtamount"],
  distanceKm: ["distance", "distancekm", "km"],
  pickupLocation: ["pickup", "pickuplocation"],
  dropLocation: ["drop", "droplocation"],
  remarks: ["remarks", "notes"],
};
export function detectMapping(headers) {
  const norm = (v) =>
    String(v)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  return Object.fromEntries(
    importFields.map((f) => [
      f,
      headers.find((h) => aliases[f].includes(norm(h))) || "",
    ]),
  );
}
export function excelDate(value) {
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) throw new Error("Invalid Excel date");
    return (
      String(d.y) +
      "-" +
      String(d.m).padStart(2, "0") +
      "-" +
      String(d.d).padStart(2, "0")
    );
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").trim();
}
function excelTime(value) {
  if (typeof value === "number") {
    const minutes = Math.round((value % 1) * 1440) % 1440;
    return (
      String(Math.floor(minutes / 60)).padStart(2, "0") +
      ":" +
      String(minutes % 60).padStart(2, "0")
    );
  }
  return String(value || "").trim();
}
export function validateRows(rows, mapping, header) {
  return rows.map((row, i) => {
    const data = { srNo: i + 1 };
    const errors = [];
    for (const f of importFields) {
      let v = mapping[f] ? row[mapping[f]] : undefined;
      if (f === "date") {
        try {
          v = excelDate(v);
        } catch (e) {
          errors.push(e.message);
        }
      } else if (f.endsWith("Time")) v = excelTime(v);
      else if (
        [
          "perTripHours",
          "totalHours",
          "gtInHours",
          "gtAmount",
          "distanceKm",
        ].includes(f)
      )
        v = v == null || v === "" ? 0 : Number(v);
      else v = String(v || "");
      data[f] = v;
    }
    const parsed = entrySchema.safeParse(data);
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map((x) => x.path.join(".") + ": " + x.message),
      );
    if (data.date < header.periodFrom || data.date > header.periodTo)
      errors.push("Date outside the selected trip period");
    const norm = (v) =>
      String(v)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    if (data.vehicleNo && norm(data.vehicleNo) !== norm(header.vehicleNumber))
      errors.push("Vehicle does not match selected trip vehicle");
    const warnings = [];
    if (!data.totalHours)
      warnings.push("Duty hours missing or zero; confirm charge basis");
    if (data.gtAmount)
      warnings.push(
        "G.T amount retained as source data; only configured calculation and explicit adjustments affect charges",
      );
    return {
      rowNumber: i + 2,
      data: parsed.success ? parsed.data : data,
      errors,
      warnings,
      status: errors.length ? "Invalid" : warnings.length ? "Warning" : "Valid",
    };
  });
}
export function parseWorkbook(buffer, sheetName) {
  const book = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const name = sheetName || book.SheetNames[0];
  if (!book.Sheets[name]) throw new Error("Worksheet not found");
  const sheet = book.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  if (range.e.r > 2000 || range.e.c > 100)
    throw new Error("Maximum 2,000 rows and 100 columns per import");
  for (const key of Object.keys(sheet)) {
    const c = sheet[key];
    if (c?.f && c.v == null)
      throw new Error(
        "Formula without a saved result at " +
          key +
          ". Recalculate and save in Excel",
      );
  }
  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  const headers = (grid.shift() || []).map(String);
  if (
    !headers.length ||
    headers.some((h) => !h.trim()) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Headers must be non-empty and unique");
  const rows = grid
    .filter((row) => row.some((v) => v !== ""))
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
  return {
    headers,
    rows,
    selectedSheet: name,
    sheetNames: book.SheetNames,
    mapping: detectMapping(headers),
  };
}
