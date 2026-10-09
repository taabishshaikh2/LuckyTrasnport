import {Vehicle,BrandedLog,WeeklyOff,FuelCharge} from "../models/index.js";
import {AppError} from "../utils/errors.js";
import {money} from "./tripCalculationService.js";
export function brandedDuty(actualHours,shiftHours,from,to,offCount) {
 const days=Math.round((new Date(to)-new Date(from))/86400000)+1;
 const weeklyOffs=offCount??Math.floor(days/7),includedHours=Math.max(0,days-weeklyOffs)*shiftHours;
 const extraMinutes=Math.max(0,Math.round((actualHours-includedHours)*60));
 return {days,weeklyOffs,includedHours,actualHours,extraMinutes,additionalServices:extraMinutes/480,extraDays:extraMinutes/1440};
}
export async function prepareBrandedVariable(input,session) {
 const from=new Date(input.periodFrom),to=new Date(input.periodTo),lines=[],vehicles=[],keys=[];
 for(const vehicleId of input.vehicleIds){
  const vehicle=await Vehicle.findOne({_id:vehicleId,branded:true,archived:false}).session(session||null).lean();
  if(!vehicle || !vehicle.shiftHours)throw new AppError("Assign a shift to the branded vehicle before billing");
  const logs=await BrandedLog.find({vehicleId,customerId:input.customerId,archived:false,date:{$gte:from,$lte:to}}).session(session||null).sort({date:1,openingTime:1}).lean();
  if(!logs.length)throw new AppError("Add branded shift logs for "+vehicle.vehicleNumber+" in this period");
  const offs=await WeeklyOff.find({vehicleId,customerId:input.customerId,archived:false,date:{$gte:from,$lte:to}}).session(session||null).lean();
  const sum=(key)=>logs.reduce((s,l)=>s+Number(l[key]||0),0);
  const metrics={...brandedDuty(sum("totalHours"),vehicle.shiftHours,from,to,offs.length?offs.length:undefined),distanceKm:sum("distanceKm"),airportFee:sum("airportFee"),logs};
  const sources=[{model:"Vehicle",record:vehicle},...logs.map(record=>({model:"BrandedLog",record})),...offs.map(record=>({model:"WeeklyOff",record}))];
  const agreement={name:"Saved branded vehicle rates",vehicleType:vehicle.customVehicleType||vehicle.vehicleType,shiftHours:vehicle.shiftHours,serviceRate:vehicle.adcRate||0,amcRate:vehicle.amcRate||0};
  const add=(description,quantity,rate,taxable=true)=>{if(quantity && rate)lines.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,description,quantity,rate,amount:money(quantity*rate),taxable});};
  if(metrics.distanceKm>0){
   const fuels=await FuelCharge.find({vehicleId,customerId:input.customerId,archived:false,periodFrom:{$lte:from},periodTo:{$gte:to}}).session(session||null).lean();
   if(fuels.length!==1)throw new AppError("Add one fuel rate and mileage covering the period for "+vehicle.vehicleNumber);
   const fuel=fuels[0];sources.push({model:"FuelCharge",record:fuel});Object.assign(agreement,{mileage:fuel.mileage,fuelRate:fuel.fuelRate,fuelType:fuel.fuelType});metrics.fuelRate=fuel.fuelRate;
   add("Fuel reimbursement ("+fuel.fuelType+")",metrics.distanceKm/fuel.mileage,fuel.fuelRate);
  }
  if(metrics.additionalServices && !vehicle.adcRate)throw new AppError("Set the ADC rate per 8-hour shift on "+vehicle.vehicleNumber);
  add("Additional services / 8-hour shifts",metrics.additionalServices,vehicle.adcRate);
  add("Monthly toll, entry & parking",1,Number(vehicle.parkingMonthly||0)+Number(vehicle.tollEntryMonthly||0));
  const airportRates=new Map();for(const log of logs)if(log.airportFee>0)airportRates.set(log.airportFee,(airportRates.get(log.airportFee)||0)+1);
  for(const [entryFee,count] of airportRates)add("Airport entry reimbursement",count,entryFee,false);
  add("AMC per actual kilometre",metrics.distanceKm,vehicle.amcRate);
  metrics.reason=`${metrics.days} days - ${metrics.weeklyOffs} weekly offs; included ${metrics.includedHours} hours; actual ${metrics.actualHours} hours; extra ${metrics.extraMinutes} minutes / 480 = ${metrics.additionalServices} shifts`;
  vehicles.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,agreement,metrics,sources,tripCount:logs.length});
  for(let day=+from;day<=+to;day+=86400000)keys.push([input.customerId,input.site,vehicleId,"Variable",new Date(day).toISOString().slice(0,10)].join(":"));
 }
 return {lines,vehicles,keys,trips:[]};
}
