import {billingShift} from "../../shared/brandedLogs.js";
import {Vehicle,FleetRate,FleetManager,BrandedLog} from "../models/index.js";
import {getShiftSettings} from "./shiftSettingsService.js";
import {vehicleRateType} from "./distanceRateService.js";
import {money} from "./tripCalculationService.js";
import {AppError} from "../utils/errors.js";
export async function prepareFixed(input,session) {
 const settings=await getShiftSettings(session),lines=[],vehicles=[],keys=[];
 const fraction=1;
 for(const vehicleId of input.vehicleIds) {
  const vehicle=await Vehicle.findOne({_id:vehicleId,archived:false}).session(session || null).lean();
  if(!vehicle)throw new AppError("Vehicle unavailable");
  if(!vehicle.branded)throw new AppError("Select a branded vehicle");
  const logs=await BrandedLog.find({vehicleId,customerId:input.customerId,archived:false,date:{$gte:new Date(input.periodFrom),$lte:new Date(input.periodTo)}}).session(session||null).lean();
  let shiftHours;try{shiftHours=billingShift(logs,input.metrics?.find(m=>m.vehicleId===vehicleId)?.shiftHours,vehicle.shiftHours);}catch(e){throw new AppError(e.message);}
  const shift=settings.entries.find(s=>s.hours===shiftHours);
  if(!shift)throw new AppError("Select a saved shift for "+vehicle.vehicleNumber);
  const rates=await FleetRate.find({customerId:input.customerId,...(input.site==="Branded"?{}:{site:input.site}),vehicleType:{$in:[vehicleRateType(vehicle),vehicle.vehicleType]},shiftHours:shift.hours,archived:false,active:true,effectiveFrom:{$lte:new Date(input.periodFrom)},$or:[{effectiveTo:{$gte:new Date(input.periodTo)}},{effectiveTo:null}]}).session(session || null).lean();
  if(rates.length!==1)throw new AppError("Save one matching monthly per-KM rate for "+vehicle.vehicleNumber+" and its selected shift");
  const rate=rates[0],quantity=shift.monthlyKm*fraction;
  lines.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,description:"Vehicle fixed cost",quantity,rate:rate.fixedRate,amount:money(quantity*rate.fixedRate),taxable:true});
  const sources=[{model:"Vehicle",record:vehicle},...logs.map(record=>({model:"BrandedLog",record})),{model:"FleetRate",record:rate},...(settings.updatedAt?[{model:"ShiftSettings",record:settings}]:[])];
  vehicles.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,agreement:{vehicleType:vehicleRateType(vehicle),name:"Selected shift",shiftHours:shift.hours,fixedKm:shift.monthlyKm,fixedRate:rate.fixedRate},metrics:{fixedFraction:fraction,reason:"Full agreed monthly shift KM and full manager salary for the selected period"},sources,tripCount:0});
  for(let day=+new Date(input.periodFrom);day<=+new Date(input.periodTo);day+=86400000)keys.push([input.customerId,input.site,vehicleId,"Fixed",new Date(day).toISOString().slice(0,10)].join(":"));
 }
 for(const id of input.managerIds) {
  const manager=await FleetManager.findOne({_id:id,customerId:input.customerId,...(input.site==="Branded"?{}:{site:input.site}),active:true,archived:false}).session(session || null).lean();
  if(!manager)throw new AppError("Select an active fleet manager for this customer and site");
  lines.push({description:"Fleet management - "+manager.name,quantity:fraction,rate:manager.monthlySalary,amount:money(fraction*manager.monthlySalary),taxable:true});
  vehicles[0].sources.push({model:"FleetManager",record:manager});
  for(let day=+new Date(input.periodFrom);day<=+new Date(input.periodTo);day+=86400000)keys.push([input.customerId,input.site,"manager",id,"Fixed",new Date(day).toISOString().slice(0,10)].join(":"));
 }
 return {lines,vehicles,keys,trips:[]};
}
