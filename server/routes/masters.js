import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  masters, BillingClaim,
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
const meta = {brandedLogs:["logId","BLOG-"],weeklyOffs:["offId","OFF-"],
  fleetManagers:["managerId","FM-"], tripRates:["rateId","TRATE-"],cityRates:["rateId","CITY-"],
  agreements: ["agreementId", "AGR-"], fleetRates:["rateId","FLEET-"], fuelCharges:["chargeId","FUEL-"], vehicleExpenses:["chargeId","EXP-"], airportExpenses:["chargeId","AIR-"],
  vehicles: ["vehicleId", "V"],
  drivers: ["driverId", "D"],
  customers: ["customerId", "C"],
  routes: ["routeId", "R"],
  rates: ["rateId", "RATE-"],
};
r.put("/weeklyOffs/month",operations,wrap(async(req,res)=>{
 const customerId=id.parse(req.body.customerId),vehicleId=id.parse(req.body.vehicleId),month=String(req.body.month||"");
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Array.isArray(req.body.dates)||req.body.dates.length>31)throw new AppError("Choose a month and valid off dates");
 const dates=req.body.dates.map(date=>masterSchemas.weeklyOffs.parse({customerId,vehicleId,date}).date);
 if(new Set(dates).size!==dates.length)throw new AppError("Each off date must appear only once");
 if(dates.some(date=>!date.startsWith(month+"-")))throw new AppError("All off dates must belong to the selected month");
 const from=new Date(month+"-01"),to=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,1));
 const saved=await transaction(async(session)=>{
  if(!await masters.customers.exists({_id:customerId,archived:false}).session(session))throw new AppError("Customer unavailable");
  const vehicle=await masters.vehicles.findOneAndUpdate({_id:vehicleId,branded:true,archived:false},{$inc:{referenceVersion:1}},{session,new:true});if(!vehicle)throw new AppError("Select a branded vehicle");
  const existing=await masters.weeklyOffs.find({customerId,vehicleId,archived:false,date:{$gte:from,$lt:to}}).session(session);
  const revision=rows=>JSON.stringify(rows.map(r=>({id:String(r._id),updatedAt:new Date(r.updatedAt).toISOString()})).sort((a,b)=>a.id.localeCompare(b.id)));
  if(!Array.isArray(req.body.expectedRows)||revision(existing)!==revision(req.body.expectedRows))throw new AppError("Off dates changed. Reload and review before saving",409);
  for(const row of existing)if(!dates.includes(row.date.toISOString().slice(0,10))){await references("weeklyOffs",{...row.toObject(),_id:String(row._id)},session);row.archived=true;row.updatedBy=req.user._id;await row.save({session});}
  for(const date of dates)if(!existing.some(row=>row.date.toISOString().slice(0,10)===date)){
   const v=masterSchemas.weeklyOffs.parse({customerId,vehicleId,date});await references("weeklyOffs",v,session);const offId=await sequence("weeklyOffs","OFF-",session);await masters.weeklyOffs.create([{...v,offId,createdBy:req.user._id,updatedBy:req.user._id}],{session});
  }
  await Audit.create([{entity:"WeeklyOff",entityId:vehicleId,previousValue:existing.map(row=>row.date),newValue:dates,reason:"Vehicle monthly off dates saved",changedBy:req.user._id}],{session});
  return {count:dates.length};
 });ok(res,saved);
}));
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
    const filter={archived:false};
    if (["brandedLogs","weeklyOffs"].includes(req.entity) && req.query.month){
      const month=String(req.query.month);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new AppError("Select a valid month");
      const from=new Date(month+"-01");filter.date={$gte:from,$lt:new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,1))};
    }
    const records = await req.Model.find(filter)
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
  ["routes", "rates", "agreements", "fleetRates", "tripRates", "cityRates", "fleetManagers"].includes(req.entity)
    ? admin(req, res, next)
    : operations(req, res, next);
export async function references(entity, v, session, readOnly=false) {
  if (["brandedLogs","weeklyOffs"].includes(entity)) {
    const vehicle=await masters.vehicles.findOne({_id:v.vehicleId,branded:true,archived:false}).session(session);
    if (!vehicle) throw new AppError("Select a branded vehicle");
    if (!await masters.customers.exists({_id:v.customerId,archived:false}).session(session)) throw new AppError("Customer unavailable");
    const day=new Date(v.date).toISOString().slice(0,10);
    if (await BillingClaim.exists({key:{$regex:":"+v.vehicleId+":Variable:"+day+"$"}}).session(session)) throw new AppError("This day is already billed. Cancel the invoice before changing its logs or weekly off",409);
    if (entity==="brandedLogs") {
      const start=+new Date(day)+Number(v.openingTime.slice(0,2))*3600000+Number(v.openingTime.slice(3))*60000,end=start+8*3600000;
      const neighbours=await masters.brandedLogs.find({vehicleId:v.vehicleId,archived:false,date:{$gte:new Date(+new Date(day)-86400000),$lte:new Date(+new Date(day)+86400000)},...(v._id?{_id:{$ne:v._id}}:{})}).session(session).lean();
      if(neighbours.some(l=>{const a=+l.date+Number(l.openingTime.slice(0,2))*3600000+Number(l.openingTime.slice(3))*60000;return a<end && a+l.totalHours*3600000>start;}))throw new AppError("This shift overlaps an existing vehicle shift",409);
    }
    const duplicate={vehicleId:v.vehicleId,date:v.date,archived:false,...(v._id?{_id:{$ne:v._id}}:{}),...(entity==="brandedLogs"?{openingTime:v.openingTime}:{})};
    if (await masters[entity].exists(duplicate).session(session)) throw new AppError("This shift / off date is already recorded",409);
    if(!readOnly) await masters.vehicles.updateOne({_id:v.vehicleId},{$inc:{referenceVersion:1}},{session});
  }

  if (["fleetRates","fuelCharges","vehicleExpenses","airportExpenses","fleetManagers"].includes(entity)) {
    if (!await masters.customers.exists({_id:v.customerId,archived:false}).session(session)) throw new AppError("Customer unavailable");
    await masters.customers.updateOne({_id:v.customerId},{$inc:{referenceVersion:1}},{session});
    if (!["fleetRates","fleetManagers"].includes(entity) && !await masters.vehicles.exists({_id:v.vehicleId,archived:false}).session(session)) throw new AppError("Vehicle unavailable");
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
    if(!readOnly) await masters.vehicles.updateOne({_id:v.vehicleId},{$inc:{referenceVersion:1}},{session});
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
      if (["brandedLogs","weeklyOffs"].includes(req.entity)) await references(req.entity,{...old.toObject(),_id:String(old._id)},session);
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
      if (source && ["brandedLogs","weeklyOffs"].includes(req.entity)) await references(req.entity,{...source.toObject(),_id:String(source._id)},session);
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
