import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { z } from "zod";
import { ImportBatch, Vehicle } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { tripSchema, id } from "../validators/index.js";
import {
  parseWorkbook,
  validateRows,
  importFields,
} from "../services/excelImportService.js";
import { previewTrip, createTrip } from "../services/tripService.js";
import { transaction } from "../services/transactionService.js";
import { wrap, ok, AppError } from "../utils/errors.js";
const r = Router();
r.use(operations);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
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
    const hash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .update(parsed.selectedSheet)
      .digest("hex");
    let batch = await ImportBatch.findOne({ hash });
    if (batch) {
      if (batch.confirmed)
        throw new AppError("This workbook was already imported", 409);
      if (String(batch.importedBy) !== String(req.user._id))
        throw new AppError(
          "Workbook is already pending review by another user",
          409,
        );
    } else
      batch = await ImportBatch.create({
        ...parsed,
        originalFilename: req.file.originalname,
        hash,
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
  const input = tripSchema.parse(req.body.header);
  const vehicle = await Vehicle.findById(input.vehicleId).session(
    session || null,
  );
  if (!vehicle) throw new AppError("Vehicle unavailable");
  const rows = validateRows(batch.rows, mapping, {
    ...input,
    vehicleNumber: vehicle.vehicleNumber,
  });
  const valid = rows.filter((x) => x.status !== "Invalid");
  if (!valid.length) throw new AppError("No valid rows to import");
  const entries = valid.map((x) => x.data);
  const header = {
    ...input,
    entries,
    distanceKm: entries.reduce((s, e) => s + e.distanceKm, 0),
    totalHours: entries.reduce((s, e) => s + e.totalHours, 0),
  };
  const p = await previewTrip(header, session);
  return { batch, mapping, rows, header, calculation: p.calculation };
}
r.post(
  "/:id/preview",
  wrap(async (req, res) => {
    const p = await prepare(req);
    ok(res, {
      rows: p.rows,
      header: p.header,
      calculation: p.calculation,
      successfulRows: p.rows.filter((x) => x.status !== "Invalid").length,
      failedRows: p.rows.filter((x) => x.status === "Invalid").length,
    });
  }),
);
r.post(
  "/:id/confirm",
  wrap(async (req, res) => {
    if (req.body.confirm !== true)
      throw new AppError("Explicit import confirmation required");
    const result = await transaction(async (s) => {
      const p = await prepare(req, s);
      if (req.body.expectedTotal !== p.calculation.totalAmount)
        throw new AppError("Review a fresh import calculation", 409);
      const trip = await createTrip(
        { ...p.header, expectedTotal: p.calculation.totalAmount },
        req.user,
        s,
        "Excel Import",
      );
      Object.assign(p.batch, {
        mapping: p.mapping,
        confirmed: true,
        importedAt: new Date(),
        successfulRows: p.header.entries.length,
        failedRows: p.rows.length - p.header.entries.length,
        tripId: trip._id,
      });
      await p.batch.save({ session: s });
      return {
        trip,
        successfulRows: p.batch.successfulRows,
        failedRows: p.batch.failedRows,
      };
    });
    ok(res, result, 201);
  }),
);
export default r;
