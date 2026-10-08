import Decimal from "decimal.js";
import { FleetRate,FuelCharge,VehicleExpense,AirportExpense } from "../models/index.js";
import { AppError } from "../utils/errors.js";
import { money } from "./tripCalculationService.js";
export function dutyAllowance(actualHours,shiftHours,periodFrom,periodTo) {
  const from=new Date(periodFrom),to=new Date(periodTo),days=(to-from)/86400000+1;
  const monthDays=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,0)).getUTCDate();
  const fraction=days/monthDays,includedDays=26*fraction,includedMinutes=Math.round(includedDays*shiftHours*60);
  const actualMinutes=Math.round(actualHours*60),extraMinutes=Math.max(0,actualMinutes-includedMinutes);
  return {fraction,includedDays,includedMinutes,actualMinutes,extraMinutes,additionalServices:extraMinutes/480};
}
export async function simpleFleetLines(type,assignment,vehicle,records,input,session) {
  const rate=await FleetRate.findOne({_id:assignment.fleetRateId,archived:false,active:true,customerId:input.customerId,site:input.site,
    vehicleType:vehicle.vehicleType,shiftHours:assignment.shiftHours,effectiveFrom:{$lte:new Date(input.periodFrom)},
    $or:[{effectiveTo:{$gte:new Date(input.periodTo)}},{effectiveTo:null},{effectiveTo:{$exists:false}}]}).session(session || null).lean();
  if (!rate) throw new AppError("Set a matching rate chart covering the period for "+vehicle.vehicleNumber);
  const sum=values=>values.reduce((n,v)=>n.add(v || 0),new Decimal(0)).toNumber();
  const metrics={...dutyAllowance(sum(records.map(t=>t.totalHours)),assignment.shiftHours,input.periodFrom,input.periodTo),
    distanceKm:sum(records.map(t=>t.distanceKm)),tripCharges:sum(records.flatMap(t=>t.entries || []).map(e=>e.sdcCharges || e.tripCharges || 0))};
  const lines=[],sources=[{model:"FleetRate",record:rate}];
  const add=(description,quantity,unitRate,taxable=true)=>{
    if (!quantity || !unitRate) return;
    lines.push({vehicleId:String(vehicle._id),vehicleNumber:vehicle.vehicleNumber,description,quantity,rate:unitRate,amount:money(new Decimal(quantity).mul(unitRate)),taxable});
  };
  const agreement={...assignment,fixedKm:({8:3000,16:4000,24:5000})[assignment.shiftHours],fixedRate:rate.fixedRate,serviceRate:rate.serviceRate,amcRate:rate.amcRate};
  if (type==="Fixed") {
    metrics.fixedFraction=metrics.fraction; metrics.reason="Contracted KM prorated by selected calendar days";
    add("Fixed deployment kilometres",agreement.fixedKm*metrics.fraction,rate.fixedRate);
  } else {
    if (!records.length) throw new AppError("No approved branded trips for "+vehicle.vehicleNumber+" in this period");
    const fuels=await FuelCharge.find({vehicleId:vehicle._id,customerId:input.customerId,site:input.site,archived:false,
      periodFrom:{$lte:new Date(input.periodFrom)},periodTo:{$gte:new Date(input.periodTo)}}).session(session || null).lean();
    if (fuels.length!==1) throw new AppError("Add one fuel record covering the invoice period for "+vehicle.vehicleNumber);
    const fuel=fuels[0];sources.push({model:"FuelCharge",record:fuel});
    Object.assign(agreement,{mileage:fuel.mileage,fuelRate:fuel.fuelRate,fuelType:fuel.fuelType});metrics.fuelRate=fuel.fuelRate;
    add("Trip charges",1,metrics.tripCharges);
    add("Fuel reimbursement ("+fuel.fuelType+")",metrics.distanceKm/fuel.mileage,fuel.fuelRate);
    if (metrics.extraMinutes && !rate.serviceRate) throw new AppError("Enter the additional-service rate per 8-hour shift");
    add("Additional services / 8-hour shifts",metrics.additionalServices,rate.serviceRate);
    add("AMC per actual kilometre",metrics.distanceKm,rate.amcRate);
    const filter={vehicleId:vehicle._id,customerId:input.customerId,site:input.site,archived:false,date:{$gte:new Date(input.periodFrom),$lte:new Date(input.periodTo)}};
    for (const [model,Model] of [["VehicleExpense",VehicleExpense],["AirportExpense",AirportExpense]]) {
      const expenses=await Model.find(filter).session(session || null).sort({date:1,_id:1}).lean();
      for (const e of expenses) {sources.push({model,record:e});add(model==="AirportExpense" ? "Airport entry reimbursement — "+e.name : e.category+" — "+e.name,e.quantity,e.rate,model!=="AirportExpense");}
    }
    metrics.reason="Included "+metrics.includedMinutes+" minutes; actual "+metrics.actualMinutes+" minutes; extra "+metrics.extraMinutes+" minutes / 480 = "+metrics.additionalServices+" shifts";
  }
  return {lines,agreement,metrics,sources};
}
