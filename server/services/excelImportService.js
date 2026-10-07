import XLSX from "xlsx";
import { entrySchema } from "../validators/index.js";
export const importFields = [
  "srNo",
  "date",
  "challanNumber",
  "vehicleNo",
  "chaName",
  "vehicleType",
  "huNumber",
  "pickupLocation",
  "dropLocation",
  "openingTime",
  "mrbArrivalTime",
  "closingTime",
  "closingDate",
  "perTripHours",
  "totalHours",
  "gtInHours",
  "overtimeKm",
  "gtAmount",
  "tripCharges",
  "tollParking",
  "totalServiceCharges",
  "distanceKm",
  "billingGroup",
  "remarks",
];
const aliases = {
  srNo: ["srno", "sno", "serialnumber"],
  date: ["date", "tripdate"],
  challanNumber: ["challan", "challanno", "challannumber"],
  vehicleNo: ["vehicle", "vehicleno", "vehiclenumber", "truckno"],
  chaName: ["chaname", "cha"],
  vehicleType: ["vehicletype", "type"],
  huNumber: ["huno", "hunumber", "vehiclehunumber"],
  pickupLocation: ["origin", "pickup", "pickuplocation"],
  dropLocation: ["destination", "destin", "drop", "droplocation"],
  openingTime: ["opening", "openingtime", "starttime", "pickuparrivaltime"],
  mrbArrivalTime: [
    "mrbarrival",
    "mrbarrivaltime",
    "midcarrivaltime",
    "arrival",
  ],
  closingTime: ["closing", "closingtime", "endtime"],
  closingDate: ["closingdate", "enddate"],
  perTripHours: ["pertriphrs", "pertriphours", "triphours"],
  totalHours: ["totalhrs", "totalhours", "hours"],
  gtInHours: [
    "gtinhrs",
    "gtinhours",
    "otinh rs".replace(/ /g, ""),
    "otinhours",
    "othours",
    "overtimehours",
  ],
  overtimeKm: ["otinkm", "overtimekm"],
  gtAmount: ["gtamount", "otamount", "overtimeamount"],
  tripCharges: ["tripcharges", "8hrspertripcharges", "amtpertripcharges"],
  tollParking: ["tollandparking", "tollparking"],
  totalServiceCharges: ["totalsvccharges", "totalservicecharges"],
  distanceKm: ["distance", "distancekm", "km"],
  billingGroup: ["billinggroup", "servicegroup"],
  remarks: ["remarks", "notes"],
};
const norm = (v) =>
  String(v)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function detectMapping(headers) {
  return Object.fromEntries(
    importFields.map((f) => [
      f,
      headers.find((h) => aliases[f].includes(norm(h))) || "",
    ]),
  );
}
export function excelDate(v) {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) throw new Error("Invalid Excel date");
    return (
      d.y +
      "-" +
      String(d.m).padStart(2, "0") +
      "-" +
      String(d.d).padStart(2, "0")
    );
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2}|\d{4})$/);
  if (!m) return s;
  const month = /^\d+$/.test(m[2])
    ? Number(m[2])
    : [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(m[2].toLowerCase()) + 1;
  return (
    (m[3].length === 2 ? "20" + m[3] : m[3]) +
    "-" +
    String(month).padStart(2, "0") +
    "-" +
    m[1].padStart(2, "0")
  );
}
export function durationHours(v, mode = "decimal") {
  if (v == null || v === "") return 0;
  if (mode === "excelTime") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid Excel duration");
    return Math.round(n * 1440) / 60;
  }
  if (mode === "decimal" && !String(v).includes(":")) return Number(v);
  const s = String(v).trim();
  const m = s.match(/^(\d+)(?:[.:](\d{1,2})(?:[.:]00)?)?$/);
  if (!m || Number(m[2] || 0) > 59)
    throw new Error("Use hours.minutes (8.30) or hours:minutes (8:30)");
  const minutes = Number(
    (m[2] || "0")[s.includes(":") ? "padStart" : "padEnd"](2, "0"),
  );
  if (minutes > 59) throw new Error("Minutes must be below 60");
  return (Number(m[1]) * 60 + minutes) / 60;
}
function excelTime(v) {
  if (v == null || v === "") return "";
  if (/^\d{1,2}$/.test(String(v)) && Number(v) >= 1 && Number(v) <= 23)
    return String(v).padStart(2, "0") + ":00";
  if (typeof v === "number" && v >= 0 && v < 1) {
    const minutes = Math.round(v * 1440) % 1440;
    return (
      String(Math.floor(minutes / 60)).padStart(2, "0") +
      ":" +
      String(minutes % 60).padStart(2, "0")
    );
  }
  const m = String(v)
    .trim()
    .match(/^(\d{1,2})[.:](\d{1,2})(?:[.:]00)?$/);
  return m
    ? m[1].padStart(2, "0") +
        ":" +
        m[2][String(v).includes(":") ? "padStart" : "padEnd"](2, "0")
    : String(v).trim();
}
export function validateRows(rows, mapping, header = {}) {
  return rows.map((row, i) => {
    const data = { srNo: i + 1 },
      errors = [],
      warnings = [];
    for (const f of importFields) {
      let v = mapping[f] ? row[mapping[f]] : undefined;
      try {
        if (f === "srNo") v = v == null || v === "" ? i + 1 : Number(v);
        else if (f === "date" || f === "closingDate")
          v = v == null || v === "" ? "" : excelDate(v);
        else if (f.endsWith("Time")) v = excelTime(v);
        else if (["perTripHours", "totalHours", "gtInHours"].includes(f))
          v = durationHours(v, header.durationFormat || "decimal");
        else if (
          [
            "gtAmount",
            "distanceKm",
            "overtimeKm",
            "tripCharges",
            "tollParking",
            "totalServiceCharges",
          ].includes(f)
        )
          v = v == null || v === "" ? 0 : Number(String(v).replace(/,/g, ""));
        else v = String(v ?? "");
      } catch (e) {
        errors.push(f + ": " + e.message);
      }
      data[f] = v;
    }
    const parsed = entrySchema.safeParse(data);
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map((x) => x.path.join(".") + ": " + x.message),
      );
    if (
      (header.periodFrom && data.date < header.periodFrom) ||
      (header.periodTo && data.date > header.periodTo)
    )
      errors.push("Date outside the selected period");
    if (
      header.vehicleNumber &&
      data.vehicleNo &&
      norm(data.vehicleNo) !== norm(header.vehicleNumber)
    )
      errors.push("Vehicle does not match selected trip vehicle");
    if (!data.totalHours)
      warnings.push("Duty hours missing or zero; confirm charge basis");
    if (data.gtAmount)
      warnings.push(
        "Source overtime amount retained for comparison with configured charges",
      );
    return {
      rowNumber: row.__rowNumber || i + 2,
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
  const sheet = book.Sheets[name];
  if (!sheet) throw new Error("Worksheet not found");
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  if (range.e.r > 2100 || range.e.c > 100)
    throw new Error("Maximum 2,000 trip rows and 100 columns per import");
  for (const [key, c] of Object.entries(sheet))
    if (c?.f && c.v == null)
      throw new Error(
        "Formula without saved result at " +
          key +
          ". Recalculate and save in Excel",
      );
  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });
  const headerIndex = grid.findIndex((row) => {
    const m = detectMapping(row.map(String));
    return m.date && (m.vehicleNo || m.totalHours || m.openingTime);
  });
  if (headerIndex < 0)
    throw new Error(
      "Could not find the trip table headings. Include Date and Vehicle No columns",
    );
  const used = grid[headerIndex]
    .map((h, i) => ({ h: String(h).trim(), i }))
    .filter((x) => x.h);
  const headers = used.map((x) => x.h);
  if (new Set(headers).size !== headers.length)
    throw new Error("Table headings must be unique");
  const mapping = detectMapping(headers),
    rows = [];
  let ignoredRows = headerIndex;
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const values = grid[i];
    if (!values.some((v) => v !== "")) {
      ignoredRows++;
      continue;
    }
    const row = Object.fromEntries(used.map((x) => [x.h, values[x.i] ?? ""]));
    const first = String(values.find((v) => v !== "") || "").trim();
    if (
      /^(total(?:\s|$)|grand total|vendor|dhl representative|signature)/i.test(
        first,
      ) ||
      String(row[mapping.date]).trim() === mapping.date
    ) {
      ignoredRows++;
      continue;
    }
    if (!row[mapping.date] && !row[mapping.vehicleNo]) {
      ignoredRows++;
      continue;
    }
    row.__rowNumber = i + 1;
    rows.push(row);
  }
  if (rows.length > 2000) throw new Error("Maximum 2,000 trip rows per import");
  return {
    headers,
    rows,
    selectedSheet: name,
    sheetNames: book.SheetNames,
    mapping,
    headerRow: headerIndex + 1,
    ignoredRows,
  };
}
