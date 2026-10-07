import { Router } from "express";
import { Trip, Invoice } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { id } from "../validators/index.js";
import {
  tripWorkbook,
  importTemplate,
} from "../services/excelExportService.js";
import { tripDocx, invoiceDocx } from "../services/docxService.js";
import { invoicePdf } from "../services/pdfService.js";
import { invoiceBalance } from "../services/paymentService.js";
import { wrap, AppError } from "../utils/errors.js";
const r = Router();
r.use(operations);
const types = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
const send = (res, buffer, name, ext) =>
  res
    .set({
      "Content-Type": types[ext],
      "Content-Disposition":
        'attachment; filename="' +
        name.replace(/[^a-zA-Z0-9_-]/g, "-") +
        "." +
        ext +
        '"',
    })
    .send(buffer);
r.get(
  "/import-template.xlsx",
  wrap(async (req, res) =>
    send(res, importTemplate(), "trip-import-template", "xlsx"),
  ),
);
r.get(
  "/trips.xlsx",
  wrap(async (req, res) => {
    const filter = {};
    for (const key of ["customerId", "vehicleId", "routeId"])
      if (req.query[key]) filter[key] = id.parse(req.query[key]);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.tripId) filter._id = id.parse(req.query.tripId);
    if (req.query.invoiceId) {
      const i = await Invoice.findById(id.parse(req.query.invoiceId));
      if (!i) throw new AppError("Invoice not found", 404);
      filter._id = { $in: i.tripIds };
    }
    if (req.query.from || req.query.to)
      filter.periodFrom = {
        ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
        ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
      };
    const trips = await Trip.find(filter)
      .populate("customerId", "companyName")
      .sort({ periodFrom: 1 })
      .limit(2000);
    if (!trips.length)
      throw new AppError(
        "No trips match the selected filters. Create or import trips before exporting.",
        404,
      );
    send(res, await tripWorkbook(trips), "lucky-trip-sheet", "xlsx");
  }),
);
r.get(
  "/trips/:id.docx",
  wrap(async (req, res) => {
    const t = await Trip.findById(id.parse(req.params.id));
    if (!t) throw new AppError("Trip not found", 404);
    send(res, await tripDocx(t), t.tripId, "docx");
  }),
);
r.get(
  "/invoices/:id.:format",
  wrap(async (req, res) => {
    if (!["pdf", "docx"].includes(req.params.format))
      throw new AppError("Unsupported format");
    const i = await Invoice.findById(id.parse(req.params.id));
    if (!i) throw new AppError("Invoice not found", 404);
    const b = await invoiceBalance(i);
    send(
      res,
      req.params.format === "pdf"
        ? await invoicePdf(i, b)
        : await invoiceDocx(i, b),
      i.invoiceNumber,
      req.params.format,
    );
  }),
);
export default r;
