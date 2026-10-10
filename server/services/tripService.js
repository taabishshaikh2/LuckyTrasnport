import { adhocRate } from "./adhocRateService.js";
import { sites } from "../../shared/sites.js";
import { distanceRate, vehicleRateType } from "./distanceRateService.js";
import {
  Vehicle,
  Driver,
  Customer,
  Route,
  Rate, TripRate, CityRate, Agreement,
  Trip,
  Audit,
} from "../models/index.js";
import { selectRate, calculateTrip } from "./tripCalculationService.js";
import { pickupDuty } from "./dutyTimeService.js";
import { sequence } from "./sequenceService.js";
import { AppError } from "../utils/errors.js";
export async function previewTrip(input, session) {
  for (const entry of input.entries) {
    if (entry.closingKm) {
      if (entry.closingKm < entry.openingKm) throw new AppError("Closing KM precedes opening KM");
      entry.distanceKm = entry.closingKm-entry.openingKm;
    }
  }
  if (input.entries.some(e=>e.closingKm || e.distanceKm)) input.distanceKm=input.entries.reduce((n,e)=>n+(e.distanceKm || 0),0);
  if (input.entries.some(e=>e.tollParking)) input.extraAmount=input.entries.reduce((n,e)=>n+(e.tollParking || 0),0);
  const challans = new Set(input.entries.map(e => e.challanNumber?.trim()).filter(Boolean));
  if (input.site && challans.size > 1) throw new AppError("One challan is one trip. Create separate trips for different challans");
  if (input.entries.length > 1) {
    let hours = 0;
    for (const entry of input.entries) {
      const duty = pickupDuty(entry);
      if (duty) { entry.totalHours = duty.totalHours; entry.closingDate = duty.closingDate; }
      hours += entry.totalHours || 0;
    }
    input.totalHours = Math.round(hours * 60) / 60;
  }
  if (input.entries.length === 1) {
    const duty = pickupDuty(input.entries[0]);
    if (duty) {
      input.totalHours = duty.totalHours;
      input.entries[0].totalHours = duty.totalHours;
      input.entries[0].closingDate = duty.closingDate;
    }
  }
  const opts = { session };
  // MongoDB sessions must not run parallel commands within a transaction.
  const vehicle = await Vehicle.findById(input.vehicleId, null, opts);
  const driver = await Driver.findById(input.driverId, null, opts);
  const customer = await Customer.findById(input.customerId, null, opts);
  const route = input.adhocService ? {routeName:sites.find(s=>s.value===input.site)?.label,category:input.site,active:true} : await Route.findById(input.routeId, null, opts);
  if(input.adhocService){
   if(input.overrideAmount!=null || input.manualAmount!=null)throw new AppError("Adhoc entries use the saved service rate");
   if(vehicle?.branded)throw new AppError("Select an Adhoc vehicle");
   if(input.dutyKind!=="Adhoc")throw new AppError("This entry format is for Adhoc vehicles");
   const city=["Inbound","Outbound"].includes(input.site);
   if(!route.routeName || city!==(input.adhocService==="City"))throw new AppError("Select the service matching this site");
   if(input.entries.length!==1 || !input.entries[0].openingTime || !input.entries[0].closingTime)throw new AppError("Enter one trip date, opening time and closing time");
   input.entries[0].perTripHours=8;input.extraAmount=0;input.deductionAmount=0;
   input.parkingSnapshot=Number(vehicle.parkingMonthly||0)+Number(vehicle.tollEntryMonthly||0);
  }
  if (
    !vehicle ||
    (input.driverId && !driver) ||
    !customer ||
    !route ||
    [vehicle, driver, customer, route]
      .filter(Boolean)
      .some((x) => x.archived) ||
    !customer.active ||
    !route.active
  )
    throw new AppError("Select available customer, vehicle, driver and route");
  if (
    ["Maintenance", "Inactive"].includes(vehicle.status) ||
    ["On Leave", "Inactive"].includes(driver?.status)
  )
    throw new AppError("Vehicle or driver is unavailable");
  if (input.status === "Submitted" && !driver && !input.adhocService)
    throw new AppError("Assign a driver before submitting the trip");
  const rates = await Rate.find(
    { routeId: route._id, active: true, archived: false },
    null,
    opts,
  ).lean();
  const chart = await TripRate.findOne({vehicleType:vehicleRateType(vehicle),active:true,archived:false},null,opts).lean();
  const assignment = await Agreement.findOne({vehicleId:vehicle._id,customerId:customer._id,site:input.site,active:true,archived:false,
    effectiveFrom:{$lte:new Date(input.periodFrom)},$or:[{effectiveTo:{$gte:new Date(input.periodTo)}},{effectiveTo:null}]
  },null,opts).lean();
  if (!chart && input.dutyKind === "Branded") throw new AppError("Add a trip rate chart for "+vehicleRateType(vehicle)+" before reviewing this trip");
  const includedHours = input.entries[0]?.perTripHours || assignment?.shiftHours || 8;
  const cityChart=input.adhocService==="City" ? await CityRate.findOne({vehicleType:vehicleRateType(vehicle),active:true,archived:false},null,opts).lean() : null;
  const rate = input.adhocService ? adhocRate(input,input.adhocService==="City"?cityChart:chart) : chart ? distanceRate(chart,input.distanceKm,includedHours) : selectRate(rates,{...input,vehicleType:vehicle.vehicleType});
  if (
    route.category === "Special" &&
    (!input.pickupLocation || !input.dropLocation)
  )
    throw new AppError("Special trips require pickup and drop locations");
  if (
    input.entries.some(
      (e) => e.date < input.periodFrom || e.date > input.periodTo,
    )
  )
    throw new AppError("Entry dates must fall within the trip period");
  return {
    vehicle,
    driver,
    customer,
    route,
    rate,
    calculation: calculateTrip(input, rate),
  };
}
export async function createTrip(input, user, session, source = "Manual") {
  const p = await previewTrip(input, session);
  if (
    input.expectedTotal == null ||
    input.expectedTotal !== p.calculation.totalAmount
  )
    throw new AppError("Review a fresh calculation before saving", 409);
  for (const modelAndRecord of [
    [Vehicle, p.vehicle],
    [Driver, p.driver],
    [Customer, p.customer],
    [Route, p.route._id ? p.route : null],
    [p.rate.source === "CityRate" ? CityRate : p.rate.source === "TripRate" ? TripRate : Rate, p.rate],
  ]) {
    const [Model, record] = modelAndRecord;
    if (!record) continue;
    const touched = await Model.updateOne(
      { _id: record._id, archived: false },
      { $inc: { referenceVersion: 1 } },
      { session },
    );
    if (!touched.modifiedCount)
      throw new AppError("A selected master record changed. Review again", 409);
  }
  if (input.status === "Submitted" && !input.adhocService) {
    const busy = await Trip.exists({
      ...(input.editingId?{_id:{$ne:input.editingId}}:{}),
      $or: [{ vehicleId: input.vehicleId }, { driverId: input.driverId }],
      status: { $in: ["Submitted", "Approved", "Invoiced"] },
      operationalCompleted: false,
    }).session(session);
    if (busy)
      throw new AppError("Vehicle or driver already has an active trip", 409);
  }
  if (input.site && input.entries[0]?.challanNumber) {
    const duplicate = await Trip.exists({ customerId: input.customerId, site: input.site,
      "entries.challanNumber": input.entries[0].challanNumber, status:{$ne:"Cancelled"},
      ...(input.editingId ? {_id:{$ne:input.editingId}} : {}),
    }).session(session);
    if (duplicate) throw new AppError("This challan already has a trip for this site/customer",409);
    await Customer.updateOne({_id:input.customerId},{$inc:{referenceVersion:1}},{session});
  }
  const calc = p.calculation;
  if(input.adhocService){input.operationalCompleted=true;input.entries=input.entries.map(e=>({...e,vehicleNo:p.vehicle.vehicleNumber,vehicleType:vehicleRateType(p.vehicle),pickupLocation:input.pickupLocation,dropLocation:input.dropLocation}));}
  if (["TripRate","CityRate"].includes(p.rate.source)) input.entries = input.entries.map((e,i)=>({...e,
    sdcCharges:i===0 ? calc.subtotal : 0,tripCharges:i===0 ? calc.baseAmount : 0,
    gtAmount:i===0 ? calc.overtimeAmount : 0,gtInHours:i===0 ? calc.overtimeHours : 0,
    totalServiceCharges:i===0 ? calc.totalAmount : 0,
    ...(i===0 ? {perTripHours:input.adhocService?8:calc.baseDutyHours} : {}),
  }));
  const tripId = await sequence("trip", "TR-", session);
  const override =
    input.overrideAmount != null ||
    p.rate.billingMethod === "Mutually Agreed / Manual"
      ? {
          originalCalculatedRate: calc.originalCalculatedRate,
          finalRate: calc.finalRate,
          overrideReason: input.overrideReason,
          overriddenBy: user._id,
          overriddenAt: new Date(),
        }
      : undefined;
  const [trip] = await Trip.create(
    [
      {
        ...input,
        ...calc,
        tripId,
        vehicleType: vehicleRateType(p.vehicle),
        vehicleNumber: p.vehicle.vehicleNumber,
        tripType: p.route.category,
        pickupLocation: input.pickupLocation || p.route.pickupLocation,
        dropLocation: input.dropLocation || p.route.dropLocation,
        rateSnapshot: p.rate,
        calculation: calc,
        override,
        source,
        createdBy: user._id,
        updatedBy: user._id,
      },
    ],
    { session },
  );
  if (override)
    await Audit.create(
      [
        {
          entity: "Trip",
          entityId: trip._id,
          previousValue: calc.originalCalculatedRate,
          newValue: calc.finalRate,
          reason: input.overrideReason,
          changedBy: user._id,
        },
      ],
      { session },
    );
  await availability(trip, session);
  return trip;
}
export async function availability(trip, session) {
  for (const [Model, id, protectedStatuses] of [
    [Vehicle, trip.vehicleId, ["Maintenance", "Inactive"]],
    [Driver, trip.driverId, ["On Leave", "Inactive"]],
  ]) {
    if (!id) continue;
    const record = await Model.findById(id).session(session);
    if (!record || protectedStatuses.includes(record.status)) continue;
    const key = Model.modelName === "Vehicle" ? "vehicleId" : "driverId";
    const busy = await Trip.exists({
      [key]: id,
      status: { $in: ["Submitted", "Approved", "Invoiced"] },
      operationalCompleted: false,
    }).session(session);
    record.status = busy ? "On Trip" : "Active";
    await record.save({ session });
  }
}
