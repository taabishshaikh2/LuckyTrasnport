import { Router } from "express";
import Decimal from "decimal.js";
import { Invoice, Trip, Customer, Audit } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { invoiceSchema, paymentSchema, id } from "../validators/index.js";
import { invoiceNumber } from "../services/sequenceService.js";
import {
  calculateInvoice,
  amountInWords,
} from "../services/invoiceCalculationService.js";
import { invoiceBalance, recordPayment } from "../services/paymentService.js";
import { transaction } from "../services/transactionService.js";
import { getCompanyProfile } from "../services/companyProfileService.js";
import { wrap, ok, AppError } from "../utils/errors.js";
import { z } from "zod";
const r = Router();
r.use(operations);
r.get(
  "/",
  wrap(async (req, res) => {
    const invoices = await Invoice.find()
      .populate("customerId", "companyName")
      .sort({ invoiceDate: -1 })
      .limit(2000);
    ok(
      res,
      await Promise.all(
        invoices.map(async (x) => ({
          ...x.toObject(),
          ...(await invoiceBalance(x)),
        })),
      ),
    );
  }),
);
async function prepare(input, session) {
  const c = await Customer.findById(input.customerId).session(session || null);
  if (!c || c.archived) throw new AppError("Customer unavailable");
  const trips = await Trip.find({
    _id: { $in: input.tripIds },
    customerId: c._id,
    status: { $in: ["Approved", "Completed"] },
  }).session(session || null);
  if (trips.length !== input.tripIds.length)
    throw new AppError(
      "Select approved/completed uninvoiced trips for this customer",
    );
  if (
    await Invoice.exists({
      tripIds: { $in: input.tripIds },
      status: { $ne: "Cancelled" },
    }).session(session || null)
  )
    throw new AppError("One or more trips are already invoiced", 409);
  const base = trips
    .reduce((d, t) => d.add(t.totalAmount), new Decimal(0))
    .toNumber();
  const profile = await getCompanyProfile(session);
  const calc = calculateInvoice(base, input, profile.stateCode);
  const from = new Date(Math.min(...trips.map((t) => +t.periodFrom)));
  const to = new Date(Math.max(...trips.map((t) => +t.periodTo)));
  const invoiceMonth = from.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const description =
    input.description ||
    "Transportation services for " +
      trips
        .map(
          (t) =>
            t.pickupLocation +
            " to " +
            t.dropLocation +
            " (" +
            t.vehicleType +
            ")",
        )
        .join(", ") +
      " for " +
      invoiceMonth +
      ".";
  return {
    ...input,
    ...calc,
    invoicedTo: c.companyName,
    billingAddress: c.address,
    gstin: c.gstin,
    dhlGstin: c.dhlGstin,
    state: c.state,
    periodFrom: from,
    periodTo: to,
    invoiceMonth,
    location: trips.map((t) => t.dropLocation).join(", "),
    description,
    amountInWords: amountInWords(calc.totalAmount),
    companySnapshot: profile,
  };
}
r.post(
  "/preview",
  wrap(async (req, res) =>
    ok(res, await prepare(invoiceSchema.parse(req.body))),
  ),
);
r.post(
  "/",
  wrap(async (req, res) => {
    const input = invoiceSchema.parse(req.body);
    const expected = z.number().parse(req.body.expectedTotal);
    const invoice = await transaction(async (s) => {
      const data = await prepare(input, s);
      if (data.totalAmount !== expected)
        throw new AppError("Calculation changed. Review invoice again", 409);
      const number = await invoiceNumber(input.invoiceDate, s);
      const [doc] = await Invoice.create(
        [{ ...data, invoiceNumber: number, createdBy: req.user._id }],
        { session: s },
      );
      for (const tripId of input.tripIds) {
        const t = await Trip.findById(tripId).session(s);
        if (!["Approved", "Completed"].includes(t.status))
          throw new AppError("Trip eligibility changed", 409);
        await Audit.create(
          [
            {
              entity: "Trip",
              entityId: t._id,
              previousValue: t.status,
              newValue: "Invoiced",
              reason: number,
              changedBy: req.user._id,
            },
          ],
          { session: s },
        );
        t.status = "Invoiced";
        t.updatedBy = req.user._id;
        await t.save({ session: s });
      }
      return doc;
    });
    ok(res, invoice, 201);
  }),
);
r.get(
  "/:id",
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const invoice = await Invoice.findById(req.params.id)
      .populate("customerId")
      .populate("tripIds");
    if (!invoice) throw new AppError("Invoice not found", 404);
    ok(res, { ...invoice.toObject(), ...(await invoiceBalance(invoice)) });
  }),
);
r.post(
  "/:id/cancel",
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const reason = z.string().trim().min(3).max(2000).parse(req.body.reason);
    await transaction(async (s) => {
      const invoice = await Invoice.findById(req.params.id).session(s);
      if (!invoice || invoice.status === "Cancelled")
        throw new AppError("Invoice unavailable");
      if ((await invoiceBalance(invoice, s)).received > 0)
        throw new AppError(
          "Invoices with payments require a credit/reversal workflow, unavailable in Phase 1",
        );
      invoice.status = "Cancelled";
      invoice.cancellationReason = reason;
      invoice.updatedBy = req.user._id;
      await invoice.save({ session: s });
      const trips = await Trip.find({ _id: { $in: invoice.tripIds } }).session(
        s,
      );
      for (const t of trips) {
        t.status = t.operationalCompleted ? "Completed" : "Approved";
        await t.save({ session: s });
      }
      await Audit.create(
        [
          {
            entity: "Invoice",
            entityId: invoice._id,
            previousValue: "Finalized",
            newValue: "Cancelled",
            reason,
            changedBy: req.user._id,
          },
        ],
        { session: s },
      );
    });
    ok(res, { cancelled: true });
  }),
);
export const paymentsRouter = Router();
paymentsRouter.use(operations);
paymentsRouter.get(
  "/",
  wrap(async (req, res) => {
    const { Payment } = await import("../models/index.js");
    ok(
      res,
      await Payment.find()
        .populate("invoiceId", "invoiceNumber")
        .populate("customerId", "companyName")
        .sort({ paymentDate: -1 })
        .limit(2000),
    );
  }),
);
paymentsRouter.post(
  "/",
  wrap(async (req, res) =>
    ok(
      res,
      await transaction((s) =>
        recordPayment(paymentSchema.parse(req.body), req.user, s),
      ),
      201,
    ),
  ),
);
export default r;
