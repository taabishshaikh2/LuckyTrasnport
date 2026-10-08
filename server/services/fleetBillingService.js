import { simpleFleetLines } from "./simpleFleetBillingService.js";
import Decimal from "decimal.js";
import crypto from "node:crypto";
import { Agreement, Vehicle, Trip, Invoice } from "../models/index.js";
import { money } from "./tripCalculationService.js";
import { AppError } from "../utils/errors.js";
const sum = values => money(values.reduce((d,v) => d.add(v || 0),new Decimal(0)));
export const reviewHash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function fleetLines(type, agreement, metrics, vehicleNumber) {
  const lines=[];
  const add=(description,quantity,rate,taxable=true,rounding="money") => {
    if (!quantity || !rate) return;
    const raw=new Decimal(quantity).mul(rate);
    const amount=rounding === "up" ? raw.ceil().toNumber() : rounding === "rupee" ? raw.toDecimalPlaces(0,Decimal.ROUND_HALF_UP).toNumber() : money(raw);
    lines.push({vehicleId:String(agreement.vehicleId),vehicleNumber,description,quantity,rate,amount,taxable,rounding});
  };
  if (type === "Fixed") {
    add("Fixed deployment kilometres", agreement.fixedKm * (metrics.fixedFraction ?? 1),agreement.fixedRate);
    add("Fleet management",metrics.managementFraction ?? 1,agreement.managementMonthly);
  } else {
    if (!(agreement.mileage > 0)) throw new AppError("Set vehicle mileage before variable billing");
    const fuelRate=metrics.fuelRate ?? agreement.fuelRate;
    if (metrics.distanceKm > 0 && !(fuelRate > 0)) throw new AppError("Enter the period fuel rate");
    add("Fuel reimbursement (" + agreement.fuelType + ")", (metrics.distanceKm || 0)/agreement.mileage, fuelRate,true,"rupee");
    add("Additional fuel litres",metrics.fuelLitres,metrics.extraFuelRate,true);
    if (metrics.fuelLitres && !metrics.extraFuelRate) throw new AppError("Enter the additional fuel rate");
    add("Additional services / shifts",metrics.additionalServices,agreement.serviceRate,true,"rupee");
    add("Additional duty hours",metrics.overtimeHours,agreement.overtimeRate);
    add("AMC per actual kilometre",metrics.distanceKm,agreement.amcRate,true,"up");
    add("Monthly parking",metrics.parkingFraction ?? 1,agreement.parkingMonthly);
    add("Airport entries",metrics.airportEntries,agreement.airportEntryRate,agreement.airportTaxable);
  }
  return lines;
}
export async function prepareFleet(input, session) {
  const from=new Date(input.periodFrom), to=new Date(input.periodTo);
  if (input.periodFrom.slice(0,7)!==input.periodTo.slice(0,7)) throw new AppError("Use one calendar month or a date range within that month for fleet billing");
  if ((to-from)/86400000 > 366) throw new AppError("Select a billing period of at most one year");
  const trips=await Trip.find({customerId:input.customerId,site:input.site,dutyKind:"Branded",vehicleId:{$in:input.vehicleIds},
    status:{$in:["Approved","Completed","Invoiced"]}, periodFrom:{$gte:from},periodTo:{$lte:to},
  }).session(session || null).sort({periodFrom:1}).lean();
  const lines=[], vehicles=[], keys=[];
  for (const vehicleId of input.vehicleIds) {
    const vehicle=await Vehicle.findOne({_id:vehicleId,archived:false}).session(session || null);
    if (!vehicle) throw new AppError("Vehicle unavailable");
    const agreements=await Agreement.find({vehicleId,customerId:input.customerId,site:input.site,archived:false,active:true,
      effectiveFrom:{$lte:from},$or:[{effectiveTo:{$gte:to}},{effectiveTo:null},{effectiveTo:{$exists:false}}],
    }).session(session || null).lean();
    if (agreements.length !== 1) throw new AppError("Configure one agreement covering the selected period for " + vehicle.vehicleNumber);
    const agreement=agreements[0], records=trips.filter(t=>String(t.vehicleId)===vehicleId);
    if (agreement.fleetRateId) {
      const prepared=await simpleFleetLines(input.billingType,agreement,vehicle,records,input,session);
      lines.push(...prepared.lines);vehicles.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,...prepared,tripCount:records.length});
      for (let day=+from;day<=+to;day+=86400000) keys.push([input.customerId,input.site,vehicleId,input.billingType,new Date(day).toISOString().slice(0,10)].join(":"));
      continue;
    }
    const entries=records.flatMap(t=>t.entries);
    const supplied=input.metrics.find(m=>m.vehicleId===vehicleId) || {};
    if (Object.keys(supplied).some(k=>!["vehicleId","reason"].includes(k)) && !supplied.reason.trim())
      throw new AppError("Explain period inputs / allocations for " + vehicle.vehicleNumber);
    const monthEnd=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,0));
    const fullMonth=from.getUTCDate()===1 && +to===+monthEnd;
    if (!fullMonth && input.billingType === "Fixed" && supplied.fixedFraction == null) throw new AppError("Enter the fixed-charge allocation for this partial/multiple-month period");
    if (!fullMonth && input.billingType === "Fixed" && agreement.managementMonthly && supplied.managementFraction == null) throw new AppError("Enter the management-charge allocation for this period");
    if (!fullMonth && input.billingType === "Variable" && agreement.parkingMonthly && supplied.parkingFraction == null) throw new AppError("Enter the parking allocation for this period");
    const exactSum=values=>values.reduce((d,v)=>d.add(v || 0),new Decimal(0)).toNumber();
    const monthStart=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),1));
    const issued=await Invoice.find({customerId:input.customerId,site:input.site,billingType:input.billingType,status:{$ne:"Cancelled"},
      vehicleIds:vehicleId,periodFrom:{$lte:monthEnd},periodTo:{$gte:monthStart},
    }).session(session || null).lean();
    for (const fraction of input.billingType === "Fixed" ? ["fixedFraction",...(agreement.managementMonthly ? ["managementFraction"] : [])] : agreement.parkingMonthly ? ["parkingFraction"] : []) {
      const used=issued.reduce((n,i)=>n+(i.narration?.vehicles?.find(v=>v.vehicleId===vehicleId)?.metrics?.[fraction] ?? 1),0);
      if (used+(supplied[fraction] ?? 1)>1.000000001) throw new AppError("Monthly allocation exceeds 100% for " + vehicle.vehicleNumber + " (" + fraction + ")",409);
    }
    const metrics={distanceKm:exactSum(records.map(t=>t.distanceKm)),additionalServices:exactSum(entries.map(e=>e.additionalServices)),
      airportEntries:sum(entries.map(e=>e.airportEntries)),fuelLitres:sum(entries.map(e=>e.fuelLitres)),overtimeHours:0,...supplied};
    if (input.billingType === "Variable" && !records.length && !supplied.reason) throw new AppError("No eligible branded duty records for " + vehicle.vehicleNumber + "; enter reviewed period inputs with a reason");
    lines.push(...fleetLines(input.billingType,agreement,metrics,vehicle.vehicleNumber));
    vehicles.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,agreement,metrics,tripCount:records.length});
    for (let day=+from; day<=+to; day+=86400000) keys.push([input.customerId,input.site,vehicleId,input.billingType,new Date(day).toISOString().slice(0,10)].join(":"));
  }
  return {lines,vehicles,keys,trips};
}
export function totalLines(lines) {
  return {taxable:sum(lines.filter(l=>l.taxable).map(l=>l.amount)),nonTaxable:sum(lines.filter(l=>!l.taxable).map(l=>l.amount))};
}
