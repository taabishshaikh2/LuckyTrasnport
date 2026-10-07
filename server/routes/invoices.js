import { Router } from "express";
import Decimal from "decimal.js";
import { Invoice, Trip, Customer, Audit, BillingClaim, Agreement } from "../models/index.js";
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
import { prepareFleet, totalLines, reviewHash } from "../services/fleetBillingService.js";
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
  let trips, lines, vehicles=[], keys, from, to;
  if (input.billingType === "Adhoc") {
    trips = await Trip.find({_id:{$in:input.tripIds},customerId:c._id,
      status:{$in:["Approved","Completed"]}, ...(input.site ? {site:input.site} : {}),
      dutyKind:{$ne:"Branded"},
    }).session(session || null).lean();
    if (trips.length !== input.tripIds.length) throw new AppError("Select approved/completed adhoc trips for this customer and site");
    if (await Invoice.exists({tripIds:{$in:input.tripIds},status:{$ne:"Cancelled"}}).session(session || null))
      throw new AppError("One or more trips are already invoiced",409);
    from=new Date(input.periodFrom || Math.min(...trips.map(t=>+t.periodFrom)));
    to=new Date(input.periodTo || Math.max(...trips.map(t=>+t.periodTo)));
    if (trips.some(t=>t.periodFrom<from || t.periodTo>to)) throw new AppError("Selected trips must fall entirely inside the billing period");
    lines=trips.map(t=>({description:t.tripId + " — " + t.pickupLocation + " to " + t.dropLocation,
      vehicleId:String(t.vehicleId),vehicleNumber:t.vehicleNumber,quantity:1,rate:t.totalAmount,amount:t.totalAmount,taxable:true,
      baseAmount:t.baseAmount,overtimeHours:t.overtimeHours,overtimeAmount:t.overtimeAmount,tollParking:t.extraAmount}));
    keys=input.tripIds.map(id=>"adhoc:"+id);
  } else {
    const fleet=await prepareFleet(input,session);
    ({trips,lines,vehicles,keys}=fleet);
    from=new Date(input.periodFrom); to=new Date(input.periodTo);
  }
  for (const charge of input.periodCharges) lines.push({...charge,quantity:1,rate:charge.amount});
  if (!lines.length || !lines.some(l=>l.amount>0)) throw new AppError("No billable charges for this selection");
  if (await BillingClaim.exists({key:{$in:keys}}).session(session || null)) throw new AppError("This billing component overlaps an issued invoice. Select an unbilled period",409);
  const profile=await getCompanyProfile(session);
  const totals=totalLines(lines);
  const calc=calculateInvoice(totals.taxable,{...input,nonTaxableAmount:totals.nonTaxable},profile.stateCode);
  const invoiceMonth=from.toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
  const tripSnapshot=trips.map(t=>({tripId:t.tripId,site:t.site,dutyKind:t.dutyKind,subtotal:t.subtotal,vehicleNumber:t.vehicleNumber,vehicleType:t.vehicleType,
    periodFrom:t.periodFrom,periodTo:t.periodTo,pickupLocation:t.pickupLocation,dropLocation:t.dropLocation,
    entries:t.entries,totalHours:t.totalHours,baseDutyHours:t.baseDutyHours,overtimeHours:t.overtimeHours,
    baseAmount:t.baseAmount,overtimeAmount:t.overtimeAmount,extraAmount:t.extraAmount,totalAmount:t.totalAmount,
    distanceKm:t.distanceKm,customerId:{companyName:c.companyName},status:t.status}));
  const data={...input,...calc,nonTaxableAmount:totals.nonTaxable,
    tripIds:input.billingType === "Adhoc" ? input.tripIds : [],
    supportingTripIds:trips.map(t=>t._id),tripSnapshot,lineItems:lines,
    narration:{billingType:input.billingType,site:input.site,vehicles,lines,periodCharges:input.periodCharges},
    invoicedTo:c.companyName,billingAddress:c.address,gstin:c.gstin,dhlGstin:c.dhlGstin,state:c.state,
    periodFrom:from,periodTo:to,invoiceMonth,location:input.site || [...new Set(trips.map(t=>t.dropLocation))].join(", "),
    description:input.description || input.billingType + " transportation services for " + (input.site || "selected trips") + " for " + invoiceMonth + ".",
    amountInWords:amountInWords(calc.totalAmount),companySnapshot:profile};
  return {...data,claimKeys:keys,reviewToken:reviewHash(data)};
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
      if ((input.site || input.billingType !== "Adhoc") && req.body.reviewToken !== data.reviewToken)
        throw new AppError("Invoice inputs or agreements changed. Review again",409);
      await Customer.updateOne({_id:input.customerId},{$inc:{referenceVersion:1}},{session:s});
      for (const vehicle of data.narration.vehicles) {
        const touched=await Agreement.updateOne({_id:vehicle.agreement._id,updatedAt:vehicle.agreement.updatedAt},{$inc:{referenceVersion:1}},{session:s});
        if (!touched.modifiedCount) throw new AppError("Agreement changed; review again",409);
      }
      const number = await invoiceNumber(input.invoiceDate, s);
      const [doc] = await Invoice.create(
        [{ ...data, invoiceNumber: number, createdBy: req.user._id }],
        { session: s },
      );
      await BillingClaim.insertMany(data.claimKeys.map(key=>({key,invoiceId:doc._id})),{session:s});
      for (const tripId of input.billingType === "Adhoc" ? input.tripIds : []) {
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
      await BillingClaim.deleteMany({invoiceId:invoice._id}).session(s);
      const trips = await Trip.find({ _id: { $in: invoice.billingType === "Adhoc" ? invoice.tripIds : [] } }).session(
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
