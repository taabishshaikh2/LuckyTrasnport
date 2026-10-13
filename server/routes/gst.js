import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Invoice, GstRecord, Audit } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { importLimit } from "../middleware/security.js";
import { wrap, ok, AppError } from "../utils/errors.js";
import { transaction } from "../services/transactionService.js";
import { combineGstRows, billKey } from "../../shared/gst.js";
import { parseGstWorkbook, gstWorkbook } from "../services/gstService.js";
const router = Router();
router.use(operations);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    "Invalid date",
  );
async function records(query) {
  const { from, to } = z
    .object({ from: date.optional(), to: date.optional() })
    .parse(query);
  if (from && to && from > to)
    throw new AppError("To date must be on or after From date");
  const range = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lt: new Date(+new Date(to) + 86400000) } : {}),
    },
    filter = from || to;
  const [invoices, imports] = await Promise.all([
    Invoice.find(filter ? { invoiceDate: range } : {}).lean(),
    GstRecord.find(filter ? { billDate: range } : {}).lean(),
  ]);
  const invoiceKeys = await Invoice.find().select("invoiceNumber").lean();
  const keys = new Set(invoiceKeys.map((i) => billKey(i.invoiceNumber)));
  return combineGstRows(
    invoices,
    imports.filter((r) => !keys.has(billKey(r.billNumber))),
  );
}
router.get(
  "/",
  wrap(async (req, res) => ok(res, await records(req.query))),
);
router.get(
  "/export.xlsx",
  wrap(async (req, res) =>
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("GST-records.xlsx")
      .send(gstWorkbook(await records(req.query))),
  ),
);
router.get(
  "/sample.xlsx",
  wrap(async (req, res) =>
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("GST-sample.xlsx")
      .send(gstWorkbook([], true)),
  ),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
router.post(
  "/import",
  importLimit,
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file || !/\.(xlsx|xls)$/i.test(req.file.originalname))
      throw new AppError("Upload an Excel workbook");
    let parsed;
    try {
      parsed = parseGstWorkbook(req.file.buffer);
    } catch {
      throw new AppError(
        "Unable to read GST workbook. Check the file and sample format",
      );
    }
    const [invoices, imports] = await Promise.all([
      Invoice.find().select("invoiceNumber").lean(),
      GstRecord.find().select("billKey").lean(),
    ]);
    const keys = new Set([
      ...invoices.map((i) => billKey(i.invoiceNumber)),
      ...imports.map((i) => i.billKey),
    ]);
    const rows = parsed.rows.filter((r) => !keys.has(r.billKey)),
      skipped = parsed.rows.length - rows.length;
    if (req.body.confirm !== "true")
      return ok(res, { rows, errors: parsed.errors, skipped });
    if (parsed.errors.length)
      throw new AppError(
        "Fix all row errors before importing. No GST records were saved",
      );
    const count = await transaction(async (session) => {
      let count = 0;
      if (rows.length) {
        const result = await GstRecord.bulkWrite(
          rows.map((row) => ({
            updateOne: {
              filter: { billKey: row.billKey },
              update: { $setOnInsert: { ...row, createdBy: req.user._id } },
              upsert: true,
            },
          })),
          { session },
        );
        count = result.upsertedCount;
        await Audit.create(
          [
            {
              entity: "GstRecord",
              reason: `Imported ${count} GST records`,
              changedBy: req.user._id,
            },
          ],
          { session },
        );
      }
      return count;
    });
    ok(res, { count, skipped: parsed.rows.length - count }, 201);
  }),
);
export default router;
