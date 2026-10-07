import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { z } from "zod";
import { ImportBatch, Vehicle, Trip } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { tripSchema, id } from "../validators/index.js";
import {
  parseWorkbook,
  validateRows,
  importFields,
} from "../services/excelImportService.js";
import { previewTrip, createTrip } from "../services/tripService.js";
import { transaction } from "../services/transactionService.js";
import { pickupDuty } from "../services/dutyTimeService.js";
import { money } from "../services/tripCalculationService.js";
import { wrap, ok, AppError } from "../utils/errors.js";
const r = Router();
r.use(operations);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
const norm = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
r.post(
  "/upload",
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file || !/\.(xlsx|xls)$/i.test(req.file.originalname))
      throw new AppError("Upload an .xlsx or .xls workbook");
    let parsed;
    try {
      parsed = parseWorkbook(req.file.buffer, req.body.sheetName);
    } catch (e) {
      throw new AppError(e.message);
    }
    const digest = hash(
      Buffer.concat([req.file.buffer, Buffer.from(parsed.selectedSheet)]),
    );
    let batch = await ImportBatch.findOne({ hash: digest });
    if (batch) {
      if (batch.confirmed)
        throw new AppError("This worksheet was already imported", 409);
      if (String(batch.importedBy) !== String(req.user._id))
        throw new AppError("Worksheet pending review by another user", 409);
    } else
      batch = await ImportBatch.create({
        ...parsed,
        originalFilename: req.file.originalname,
        hash: digest,
        importedBy: req.user._id,
        rowCount: parsed.rows.length,
      });
    ok(res, { batchId: batch._id, ...parsed, fields: importFields });
  }),
);
async function prepare(req, session) {
  const batch = await ImportBatch.findOne({
    _id: id.parse(req.params.id),
    importedBy: req.user._id,
    confirmed: false,
  }).session(session || null);
  if (!batch)
    throw new AppError("Import unavailable or already confirmed", 409);
  const mapping = z.record(z.string()).parse(req.body.mapping);
  if (!mapping.date) throw new AppError("Map the Date column");
  for (const v of Object.values(mapping))
    if (v && !batch.headers.includes(v))
      throw new AppError("Unknown mapped column");
  const defaults = req.body.header || {};
  id.parse(defaults.customerId);
  id.parse(defaults.routeId);
  const durationFormat = z
    .enum(["hoursMinutes", "decimal", "excelTime"])
    .parse(req.body.durationFormat || "hoursMinutes");
  const rows = validateRows(batch.rows, mapping, {
    periodFrom: defaults.periodFrom,
    periodTo: defaults.periodTo,
    durationFormat,
  });
  // Explicit challan numbers join continuation rows into one logical trip.
  const grouped=[]; const challans=new Map(); const exactRows=new Set();
  for (const row of rows) {
    const identity=JSON.stringify({...row.data,srNo:undefined});
    if (exactRows.has(identity)) {row.status="Duplicate";row.warnings.push("Identical duty row repeated; skipped");continue;}
    exactRows.add(identity);
    const key=row.data.challanNumber ? [norm(row.data.challanNumber),norm(row.data.vehicleNo)].join(":") : "";
    const prior=key && challans.get(key);
    if (prior) {
      prior.continuations.push(row);
      prior.errors.push(...row.errors); prior.warnings.push(...row.warnings);
      if (prior.errors.length) prior.status="Invalid";
    } else {row.continuations=[];grouped.push(row);if(key) challans.set(key,row);}
  }
  const vehicles = await Vehicle.find({ archived: false }).session(
    session || null,
  );
  const lookup = new Map(vehicles.map((v) => [norm(v.vehicleNumber), v]));
  const seen = new Set();
  for (const row of grouped) {
    if (row.status === "Invalid") continue;
    const e = row.data;
    try {
      const vehicle = e.vehicleNo
        ? lookup.get(norm(e.vehicleNo))
        : vehicles.find((v) => String(v._id) === defaults.vehicleId);
      if (!vehicle)
        throw new Error(
          "Vehicle not found. Add it in Vehicles or correct the vehicle number",
        );
      e.vehicleNo = vehicle.vehicleNumber;
      if (e.vehicleType && norm(e.vehicleType) !== norm(vehicle.vehicleType))
        row.warnings.push(
          "Sheet vehicle type differs from master; master vehicle type used for rate selection",
        );
      if (!e.challanNumber)
        row.warnings.push("Challan number missing; add it to this draft later");
      if (!defaults.driverId)
        row.warnings.push("Driver unassigned; assign before submission");
      const allEntries=[row,...row.continuations].map(r=>r.data).sort((a,b)=>(a.date+a.openingTime).localeCompare(b.date+b.openingTime));
      for (const segment of allEntries) {
        const duty=pickupDuty(segment);
        if (duty) {segment.totalHours=duty.totalHours; segment.closingDate=duty.closingDate;}
        if (segment.closingKm && segment.closingKm<segment.openingKm) throw new Error("Closing KM precedes opening KM");
        if (segment.closingKm) segment.distanceKm=segment.closingKm-segment.openingKm;
      }
      const duty = pickupDuty(e);
      if (duty) {
        if (duty.inferred)
          row.warnings.push(
            "Closing time is next day; inferred overnight duty",
          );
        if (e.totalHours && Math.abs(e.totalHours - duty.totalHours) * 60 > 1)
          row.warnings.push(
            "Source total hours differ from pickup-arrival to closing time; calculated duration used",
          );
        e.totalHours = duty.totalHours;
        e.closingDate = duty.closingDate;
      } else
        row.warnings.push(
          "Pickup arrival or closing time missing; source total hours used",
        );
      const input = tripSchema.parse({
        ...defaults,
        vehicleId: String(vehicle._id),
        periodFrom: allEntries[0].date,
        periodTo: allEntries.reduce((max,s)=>s.closingDate>max ? s.closingDate : s.date>max ? s.date : max,allEntries[0].date),
        status: "Draft",
        entries: allEntries,
        totalHours: allEntries.reduce((n,s)=>n+s.totalHours,0),
        distanceKm: allEntries.reduce((n,s)=>n+s.distanceKm,0),
        pickupLocation: e.pickupLocation || defaults.pickupLocation,
        dropLocation: e.dropLocation || defaults.dropLocation,
        extraAmount: defaults.dutyKind === "Branded" ? 0 : allEntries.reduce((n,s)=>n+s.tollParking,0),
        deductionAmount: 0,
        manualAmount: undefined,
        overrideAmount: undefined,
        overrideReason: "",
      });
      const fingerprint = hash(
        JSON.stringify(
          e.challanNumber
            ? [
                defaults.customerId,
                defaults.site || defaults.routeId,
                norm(e.challanNumber),
                norm(e.vehicleNo),
              ]
            : [
                defaults.customerId,
                defaults.routeId,
                e.date,
                norm(e.vehicleNo),
                e.openingTime,
                e.closingTime,
                e.huNumber,
              ],
        ),
      );
      if (
        seen.has(fingerprint) ||
        (await Trip.exists({ importFingerprint: fingerprint }).session(
          session || null,
        ))
      ) {
        row.status = "Duplicate";
        row.warnings.push(
          "Matching trip already imported or repeated in this worksheet; skipped",
        );
        continue;
      }
      seen.add(fingerprint);
      const p = await previewTrip(input, session);
      row.calculation = p.calculation;
      row.input = input;
      row.fingerprint = fingerprint;
      if (
        e.perTripHours &&
        Math.abs(e.perTripHours - p.rate.baseHours) > 0.0001
      )
        row.warnings.push(
          "Source included hours differ from configured rate; configured rule used",
        );
      for (const [field, amount, label] of [
        ["tripCharges", p.calculation.baseAmount, "Trip charge"],
        ["gtAmount", p.calculation.overtimeAmount, "Overtime amount"],
        [
          "totalServiceCharges",
          p.calculation.totalAmount,
          "Total service charge",
        ],
      ])
        if (mapping[field] && Math.abs(e[field] - amount) > 0.01)
          row.warnings.push(
            label + " differs from source amount (" + e[field] + ")",
          );
      if (e.overtimeKm)
        row.warnings.push(
          "O.T. IN KM preserved; its charging rule is pending confirmation",
        );
      row.status = row.warnings.length ? "Warning" : "Valid";
    } catch (err) {
      row.errors.push(err.message);
      row.status = "Invalid";
    }
  }
  for (const row of grouped) for (const continuation of row.continuations) {
    continuation.status="Continuation";
    continuation.warnings.push("Part of challan trip at row " + row.rowNumber + "; one base fare for the whole trip");
  }
  const accepted = grouped.filter((x) => ["Valid", "Warning"].includes(x.status));
  const reviewToken = hash(
    JSON.stringify(
      rows.map((x) => ({
        row: x.rowNumber,
        status: x.status,
        input: x.input,
        calculation: x.calculation,
        fingerprint: x.fingerprint,
      })),
    ),
  );
  return {
    batch,
    mapping,
    rows,
    accepted,
    reviewToken,
    calculation: {
      totalAmount: money(
        accepted.reduce((s, x) => s + x.calculation.totalAmount, 0),
      ),
    },
  };
}
const response = (p) => ({
  rows: p.rows.map(({ input, fingerprint, continuations, ...row }) => row),
  calculation: p.calculation,
  reviewToken: p.reviewToken,
  successfulRows: p.accepted.length,
  failedRows: p.rows.filter((x) => x.status === "Invalid").length,
  duplicateRows: p.rows.filter((x) => x.status === "Duplicate").length,
});
r.post(
  "/:id/preview",
  wrap(async (req, res) => ok(res, response(await prepare(req)))),
);
r.post(
  "/:id/confirm",
  wrap(async (req, res) => {
    if (req.body.confirm !== true)
      throw new AppError("Explicit confirmation required");
    const result = await transaction(async (s) => {
      const p = await prepare(req, s);
      if (!p.accepted.length)
        throw new AppError("No new valid trips to import");
      if (req.body.reviewToken !== p.reviewToken)
        throw new AppError(
          "Import data or rates changed. Review a fresh preview",
          409,
        );
      const trips = [];
      for (const row of p.accepted) {
        const trip = await createTrip(
          {
            ...row.input,
            expectedTotal: row.calculation.totalAmount,
            importFingerprint: row.fingerprint,
            importSource: {
              batchId: p.batch._id,
              filename: p.batch.originalFilename,
              sheetName: p.batch.selectedSheet,
              rowNumber: row.rowNumber,
            },
          },
          req.user,
          s,
          "Excel Import",
        );
        trips.push({
          _id: trip._id,
          tripId: trip.tripId,
          rowNumber: row.rowNumber,
        });
      }
      Object.assign(p.batch, {
        mapping: p.mapping,
        confirmed: true,
        importedAt: new Date(),
        successfulRows: trips.length,
        failedRows: p.rows.length - trips.length,
        tripIds: trips.map((t) => t._id),
      });
      await p.batch.save({ session: s });
      return { ...response(p), trips };
    });
    ok(res, result, 201);
  }),
);
export default r;
