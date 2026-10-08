import {Vehicle,FleetRate,FleetManager} from "../models/index.js";
import {getShiftSettings} from "./shiftSettingsService.js";
import {vehicleRateType} from "./distanceRateService.js";
import {money} from "./tripCalculationService.js";
import {AppError} from "../utils/errors.js";
export async function prepareFixed(input,session) {
 const settings=await getShiftSettings(session),lines=[],vehicles=[],keys=[];
 const fraction=((new Date(input.periodTo)-new Date(input.periodFrom))/86400000+1)/new Date(Date.UTC(new Date(input.periodFrom).getUTCFullYear(),new Date(input.periodFrom).getUTCMonth()+1,0)).getUTCDate();
 for(const vehicleId of input.vehicleIds) {
  const vehicle=await Vehicle.findOne({_id:vehicleId,archived:false}).session(session || null).lean();
  if(!vehicle)throw new AppError("Vehicle unavailable");
  if(!vehicle.branded)throw new AppError("Select a branded vehicle");
  const shift=settings.entries.find(s=>s.hours===vehicle.shiftHours);
  if(!shift)throw new AppError("Select a saved shift for "+vehicle.vehicleNumber);
  const rates=await FleetRate.find({customerId:input.customerId,site:input.site,vehicleType:{$in:[vehicleRateType(vehicle),vehicle.vehicleType]},shiftHours:shift.hours,archived:false,active:true,effectiveFrom:{$lte:new Date(input.periodFrom)},$or:[{effectiveTo:{$gte:new Date(input.periodTo)}},{effectiveTo:null}]}).session(session || null).lean();
  if(rates.length!==1)throw new AppError("Save one matching monthly per-KM rate for "+vehicle.vehicleNumber+" and its selected shift");
  const rate=rates[0],quantity=shift.monthlyKm*fraction;
  lines.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,description:"Vehicle fixed cost",quantity,rate:rate.fixedRate,amount:money(quantity*rate.fixedRate),taxable:true});
  const sources=[{model:"Vehicle",record:vehicle},{model:"FleetRate",record:rate},...(settings.updatedAt?[{model:"ShiftSettings",record:settings}]:[])];
  vehicles.push({vehicleId,vehicleNumber:vehicle.vehicleNumber,agreement:{name:"Selected shift",shiftHours:shift.hours,fixedKm:shift.monthlyKm,fixedRate:rate.fixedRate},metrics:{fixedFraction:fraction,reason:"Agreed monthly shift KM; partial periods prorated by calendar days"},sources,tripCount:0});
  for(let day=+new Date(input.periodFrom);day<=+new Date(input.periodTo);day+=86400000)keys.push([input.customerId,input.site,vehicleId,"Fixed",new Date(day).toISOString().slice(0,10)].join(":"));
 }
 for(const id of input.managerIds) {
  const manager=await FleetManager.findOne({_id:id,customerId:input.customerId,site:input.site,active:true,archived:false}).session(session || null).lean();
  if(!manager)throw new AppError("Select an active fleet manager for this customer and site");
  lines.push({description:"Fleet management - "+manager.name,quantity:fraction,rate:manager.monthlySalary,amount:money(fraction*manager.monthlySalary),taxable:true});
  vehicles[0].sources.push({model:"FleetManager",record:manager});
  for(let day=+new Date(input.periodFrom);day<=+new Date(input.periodTo);day+=86400000)keys.push([input.customerId,input.site,"manager",id,"Fixed",new Date(day).toISOString().slice(0,10)].join(":"));
 }
 return {lines,vehicles,keys,trips:[]};
}
