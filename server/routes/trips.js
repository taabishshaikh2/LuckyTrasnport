import { Router } from "express";
import { Trip, Audit, Vehicle, Driver, Invoice } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { tripSchema, id } from "../validators/index.js";
import {
  previewTrip,
  createTrip,
  availability,
} from "../services/tripService.js";
import { transaction } from "../services/transactionService.js";
import { wrap, ok, AppError } from "../utils/errors.js";
import { z } from "zod";
const r = Router();
r.post("/:id/archive", operations, wrap(async (req,res)=>{
  id.parse(req.params.id);
  const {archived}=z.object({archived:z.boolean()}).parse(req.body);
  const result=await transaction(async session=>{
    const trip=await Trip.findById(req.params.id).session(session);
    if(!trip)throw new AppError("Trip not found",404);
    if(!["Draft","Cancelled"].includes(trip.status))throw new AppError("Cancel the trip before archiving it",409);
    if(await Invoice.exists({tripIds:trip._id,status:{$ne:"Cancelled"}}).session(session))throw new AppError("This trip belongs to an invoice. Cancel the invoice first",409);
    const previous=trip.toObject();
    trip.archived=archived;trip.updatedBy=req.user._id;
    await trip.save({session});
    await Audit.create([{entity:"Trip",entityId:trip._id,previousValue:previous,newValue:trip.toObject(),reason:archived?"Trip archived":"Trip restored",changedBy:req.user._id}],{session});
    return trip;
  });ok(res,result);
}));
r.get(
  "/",
  wrap(async (req, res) => {
    const filter = { archived: req.query.archived === "true" ? true : { $ne: true } };
    if (req.user.role === "DRIVER") {
      if (!req.user.driverId) return ok(res, []);
      filter.driverId = req.user.driverId;
    }
    for (const k of ["customerId", "vehicleId", "routeId", "driverId"])
      if (req.query[k] && (req.user.role !== "DRIVER" || k !== "driverId"))
        filter[k] = id.parse(req.query[k]);
    if (req.query.site) filter.site = String(req.query.site);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.from || req.query.to)
      filter.periodFrom = {
        ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
        ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
      };
    ok(
      res,
      await Trip.find(filter)
        .populate("customerId", "companyName")
        .populate("driverId", "fullName")
        .sort({ periodFrom: -1 })
        .limit(2000),
    );
  }),
);
r.post(
  "/preview",
  operations,
  wrap(async (req, res) => {
    const p = await previewTrip(tripSchema.parse(req.body));
    ok(res, {
      calculation: p.calculation,
      rate: p.rate,
      vehicleType: p.vehicle.vehicleType,
      routeName: p.route.routeName,
    });
  }),
);
r.post(
  "/",
  operations,
  wrap(async (req, res) =>
    ok(
      res,
      await transaction((s) =>
        createTrip(tripSchema.parse(req.body), req.user, s),
      ),
      201,
    ),
  ),
);
r.get(
  "/:id",
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const trip = await Trip.findById(req.params.id)
      .populate("customerId")
      .populate("vehicleId")
      .populate("driverId")
      .populate("routeId");
    if (!trip) throw new AppError("Trip not found", 404);
    if (
      req.user.role === "DRIVER" &&
      String(trip.driverId?._id) !== String(req.user.driverId)
    )
      throw new AppError("Trip is not assigned to you", 403);
    const audit = await Audit.find({ entityId: trip._id }).sort({
      createdAt: -1,
    });
    ok(res, { ...trip.toObject(), audit });
  }),
);
r.patch(
  "/:id",
  operations,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const input = tripSchema.parse(req.body);
    const result = await transaction(async (s) => {
      const old = await Trip.findById(req.params.id).session(s);
      if (!old || old.archived || !["Draft","Submitted","Approved","Completed"].includes(old.status))
        throw new AppError("This trip cannot be edited. Cancel its invoice first if it has been invoiced");
      if(await Invoice.exists({tripIds:old._id,status:{$ne:"Cancelled"}}).session(s))throw new AppError("Cancel the invoice before editing this trip",409);
      const originalId = old.tripId;
      const previous = old.toObject();
      const replacement = await createTrip(
        { ...input, status:old.status==="Draft"?input.status:old.status==="Completed"?"Draft":"Submitted", editingId: old._id },
        req.user,
        s,
        old.source || "Manual",
      );
      await Trip.deleteOne({ _id: replacement._id }).session(s);
      const data = replacement.toObject();
      delete data._id;
      delete data.createdAt;
      data.tripId = originalId;
      if(previous.status!=="Draft"){data.status=previous.status;data.operationalCompleted=previous.operationalCompleted;}
      data.createdBy = old.createdBy;
      Object.assign(old, data);
      await old.save({ session: s });
      await Audit.updateMany(
        { entityId: replacement._id },
        { $set: { entityId: old._id } },
      ).session(s);
      await Audit.create(
        [
          {
            entity: "Trip",
            entityId: old._id,
            previousValue: previous,
            newValue: old.toObject(),
            reason: "Trip revised",
            changedBy: req.user._id,
          },
        ],
        { session: s },
      );
      await availability(old, s);
      return old;
    });
    ok(res, result);
  }),
);
r.post(
  "/:id/status",
  operations,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const input = z
      .object({
        status: z.enum(["Submitted", "Approved", "Completed", "Cancelled"]),
        reason: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const result = await transaction(async (s) => {
      const t = await Trip.findById(req.params.id).session(s);
      if (!t || t.archived) throw new AppError("Trip not found", 404);
      const transitions = {
        Draft: ["Submitted", "Cancelled"],
        Submitted: ["Approved", "Cancelled"],
        Approved: ["Completed", "Cancelled"],
        Completed: ["Cancelled"],
        Invoiced: ["Completed"],
      };
      if (!transitions[t.status]?.includes(input.status))
        throw new AppError("Invalid trip status transition");
      if (input.status === "Cancelled" && !input.reason?.trim())
        throw new AppError("Cancellation requires a reason");
      if (input.status === "Submitted" && !t.adhocService) {
        if (t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate") throw new AppError("Edit this draft and review its saved trip-chart rates before submitting");
        if (!t.driverId)
          throw new AppError("Assign a driver before submitting the trip");
        for (const [M, ref] of [
          [Vehicle, t.vehicleId],
          [Driver, t.driverId],
        ])
          await M.updateOne(
            { _id: ref },
            { $inc: { referenceVersion: 1 } },
            { session: s },
          );
        const busy = await Trip.exists({
          _id: { $ne: t._id },
          $or: [{ vehicleId: t.vehicleId }, { driverId: t.driverId }],
          status: { $in: ["Submitted", "Approved", "Invoiced"] },
          operationalCompleted: false,
        }).session(s);
        if (busy)
          throw new AppError(
            "Vehicle or driver already has an active trip",
            409,
          );
        const v = await Vehicle.findById(t.vehicleId).session(s);
        const d = await Driver.findById(t.driverId).session(s);
        if (
          v.archived ||
          d.archived ||
          ["Maintenance", "Inactive"].includes(v.status) ||
          ["On Leave", "Inactive"].includes(d.status)
        )
          throw new AppError("Vehicle or driver unavailable");
      }
      const previous = t.status;
      t.status =
        t.status === "Invoiced" && input.status === "Completed"
          ? "Invoiced"
          : input.status;
      t.operationalCompleted =
        input.status === "Completed" || t.operationalCompleted;
      t.updatedBy = req.user._id;
      await t.save({ session: s });
      await availability(t, s);
      await Audit.create(
        [
          {
            entity: "Trip",
            entityId: t._id,
            previousValue: previous,
            newValue: input.status,
            reason: input.reason || "Workflow transition",
            changedBy: req.user._id,
          },
        ],
        { session: s },
      );
      return t;
    });
    ok(res, result);
  }),
);
export default r;
