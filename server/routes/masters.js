import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  masters,
  User,
  Trip,
  Invoice,
  Rate,
  Driver,
  Audit,
} from "../models/index.js";
import { operations, admin } from "../middleware/auth.js";
import { masterSchemas, userSchema, id } from "../validators/index.js";
import { sequence } from "../services/sequenceService.js";
import { transaction } from "../services/transactionService.js";
import { wrap, ok, AppError } from "../utils/errors.js";
const r = Router();
const meta = {
  agreements: ["agreementId", "AGR-"], fleetRates:["rateId","FLEET-"], fuelCharges:["chargeId","FUEL-"], vehicleExpenses:["chargeId","EXP-"], airportExpenses:["chargeId","AIR-"],
  vehicles: ["vehicleId", "V"],
  drivers: ["driverId", "D"],
  customers: ["customerId", "C"],
  routes: ["routeId", "R"],
  rates: ["rateId", "RATE-"],
};
r.get(
  "/users",
  admin,
  wrap(async (req, res) => ok(res, await User.find().sort({ name: 1 }))),
);
r.post(
  "/users",
  admin,
  wrap(async (req, res) => {
    const v = userSchema.parse(req.body);
    if (!v.password) throw new AppError("Password is required");
    if (
      v.driverId &&
      !(await Driver.exists({ _id: v.driverId, archived: false }))
    )
      throw new AppError("Driver does not exist");
    ok(
      res,
      await User.create({
        ...v,
        passwordHash: await bcrypt.hash(v.password, 12),
      }),
      201,
    );
  }),
);
r.patch(
  "/users/:id",
  admin,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const v = userSchema.parse(req.body);
    if (
      v.driverId &&
      !(await Driver.exists({ _id: v.driverId, archived: false }))
    )
      throw new AppError("Driver does not exist");
    if (
      req.params.id === String(req.user._id) &&
      (!v.active || v.role !== "ADMIN")
    )
      throw new AppError("You cannot remove your own administrative access");
    const passwordHash = v.password
      ? await bcrypt.hash(v.password, 12)
      : undefined;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { ...v, ...(passwordHash ? { passwordHash } : {}) } },
      { new: true },
    );
    if (!updated) throw new AppError("User not found", 404);
    ok(res, updated);
  }),
);
r.use("/:entity", (req, res, next) => {
  if (!masters[req.params.entity]) return next(new AppError("Not found", 404));
  req.entity = req.params.entity;
  req.Model = masters[req.entity];
  next();
});
r.get(
  "/:entity",
  operations,
  wrap(async (req, res) => {
    const records = await req.Model.find({ archived: false })
      .sort(req.entity === "routes" ? { order: 1 } : { createdAt: -1 })
      .limit(2000)
      .lean();
    ok(res, records);
  }),
);
r.get(
  "/:entity/:id",
  operations,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const record = await req.Model.findById(req.params.id);
    if (!record) throw new AppError("Record not found", 404);
    ok(res, record);
  }),
);
const permission = (req, res, next) =>
  ["routes", "rates", "agreements", "fleetRates"].includes(req.entity)
    ? admin(req, res, next)
    : operations(req, res, next);
async function references(entity, v, session) {
  if (["fleetRates","fuelCharges","vehicleExpenses","airportExpenses"].includes(entity)) {
    if (!await masters.customers.exists({_id:v.customerId,archived:false}).session(session)) throw new AppError("Customer unavailable");
    await masters.customers.updateOne({_id:v.customerId},{$inc:{referenceVersion:1}},{session});
    if (entity!=="fleetRates" && !await masters.vehicles.exists({_id:v.vehicleId,archived:false}).session(session)) throw new AppError("Vehicle unavailable");
    if (["fleetRates","fuelCharges"].includes(entity)) {
      const start=entity==="fleetRates" ? "effectiveFrom" : "periodFrom",end=entity==="fleetRates" ? "effectiveTo" : "periodTo";
      const filter={archived:false,customerId:v.customerId,site:v.site,...(v._id?{_id:{$ne:v._id}}:{}),
        ...(entity==="fleetRates"?{vehicleType:v.vehicleType,shiftHours:v.shiftHours,active:true}:{vehicleId:v.vehicleId}),
        [start]:{$lte:v[end] || new Date("9999-12-31")},$or:[{[end]:{$gte:v[start]}},{[end]:null},{[end]:{$exists:false}}]};
      if (v.active!==false && await masters[entity].exists(filter).session(session)) throw new AppError("Overlapping rate or fuel periods; use separate date ranges");
    }
  }

  if (entity === "agreements") {
    if (v.fleetRateId) {
      const rate=await masters.fleetRates.findOne({_id:v.fleetRateId,archived:false,active:true}).session(session);
      const vehicle=await masters.vehicles.findById(v.vehicleId).session(session);
      if (!rate || String(rate.customerId)!==v.customerId || rate.site!==v.site || rate.vehicleType!==vehicle?.vehicleType || rate.shiftHours!==v.shiftHours)
        throw new AppError("Select a rate for this vehicle type, customer, site and shift");
      v.fixedKm=({8:3000,16:4000,24:5000})[v.shiftHours]; v.fixedRate=rate.fixedRate;
    }

    for (const [model,key] of [[masters.vehicles,"vehicleId"],[masters.customers,"customerId"]])
      if (!await model.exists({_id:v[key],archived:false}).session(session)) throw new AppError("Agreement reference unavailable");
    await masters.vehicles.updateOne({_id:v.vehicleId},{$inc:{referenceVersion:1}},{session});
    const overlaps = await masters.agreements.exists({ vehicleId:v.vehicleId, customerId:v.customerId,
      site:v.site, active:true, archived:false, ...(v._id ? {_id:{$ne:v._id}} : {}),
      effectiveFrom:{$lte:v.effectiveTo || new Date("9999-12-31")},
      $or:[{effectiveTo:{$gte:v.effectiveFrom}},{effectiveTo:{$exists:false}},{effectiveTo:null}],
    }).session(session);
    if (v.active && overlaps) throw new AppError("Overlapping vehicle agreements; end the previous agreement first");
  }
  if (
    entity === "drivers" &&
    v.assignedVehicleId &&
    !(await masters.vehicles
      .exists({ _id: v.assignedVehicleId, archived: false })
      .session(session))
  )
    throw new AppError("Assigned vehicle unavailable");
  if (
    entity === "rates" &&
    !(await masters.routes
      .exists({ _id: v.routeId, archived: false })
      .session(session))
  )
    throw new AppError("Route unavailable");
}
r.post(
  "/:entity",
  permission,
  wrap(async (req, res) => {
    const v = masterSchemas[req.entity].parse(req.body);
    if (v.status === "On Trip")
      throw new AppError("On Trip status is set by operational trips");
    const record = await transaction(async (session) => {
      await references(req.entity, v, session);
      const [key, prefix] = meta[req.entity];
      const businessId = await sequence(req.entity, prefix, session);
      const [doc] = await req.Model.create(
        [
          {
            ...v,
            [key]: businessId,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session },
      );
      return doc;
    });
    ok(res, record, 201);
  }),
);
r.patch(
  "/:entity/:id",
  permission,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    const v = masterSchemas[req.entity].parse(req.body);
    const record = await transaction(async (session) => {
      await references(req.entity, { ...v, _id: req.params.id }, session);
      const old = await req.Model.findById(req.params.id).session(session);
      if (!old || old.archived) throw new AppError("Record unavailable", 404);
      if (
        ["vehicles", "drivers"].includes(req.entity) &&
        v.status === "On Trip" &&
        old.status !== "On Trip"
      )
        throw new AppError("On Trip status is set by operational trips");
      if (
        ["vehicles", "drivers"].includes(req.entity) &&
        v.status === "Active"
      ) {
        const key = req.entity === "vehicles" ? "vehicleId" : "driverId";
        if (
          await Trip.exists({
            [key]: old._id,
            status: { $in: ["Submitted", "Approved", "Invoiced"] },
            operationalCompleted: false,
          }).session(session)
        )
          v.status = "On Trip";
      }
      old.$locals.previousValue = old.toObject();
      Object.assign(old, v, { updatedBy: req.user._id });
      await old.save({ session });
      await Audit.create(
        [
          {
            entity: req.entity,
            entityId: old._id,
            previousValue: old.$locals.previousValue,
            newValue: v,
            reason: "Master configuration updated",
            changedBy: req.user._id,
          },
        ],
        { session },
      );
      return old;
    });
    ok(res, record);
  }),
);
r.delete(
  "/:entity/:id",
  permission,
  wrap(async (req, res) => {
    id.parse(req.params.id);
    await transaction(async (session) => {
      const keys = {
        vehicles: "vehicleId",
        drivers: "driverId",
        customers: "customerId",
        routes: "routeId",
      };
      const key = keys[req.entity];
      if (
        key &&
        (await Trip.exists({
          [key]: req.params.id,
          $or: [
            { status: "Draft" },
            {
              status: { $in: ["Submitted", "Approved", "Invoiced"] },
              operationalCompleted: false,
            },
          ],
        }).session(session))
      )
        throw new AppError(
          "This record has unfinished trips. Complete or cancel them first",
        );
      if (
        req.entity === "routes" &&
        (await Rate.exists({
          routeId: req.params.id,
          archived: false,
          active: true,
        }).session(session))
      )
        throw new AppError(
          "Disable dependent rates before archiving the route",
        );
      const source=await req.Model.findById(req.params.id).session(session);
      if (source?.customerId) await masters.customers.updateOne({_id:source.customerId},{$inc:{referenceVersion:1}},{session});
      const updated = await req.Model.findByIdAndUpdate(
        req.params.id,
        {
          $set: { archived: true, updatedBy: req.user._id },
          $inc: { referenceVersion: 1 },
        },
        { session, new: true },
      );
      if (!updated) throw new AppError("Record unavailable", 404);
      await Audit.create(
        [
          {
            entity: req.entity,
            entityId: updated._id,
            reason: "Archived",
            changedBy: req.user._id,
          },
        ],
        { session },
      );
    });
    ok(res, { archived: true });
  }),
);
export default r;
