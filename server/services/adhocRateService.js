import { AppError } from "../utils/errors.js";
export function adhocRate(input,chart){
 if(!chart)throw new AppError("Save a matching "+(input.adhocService==="City"?"city trip":"kilometre")+" rate for this vehicle type");
 if(input.adhocService==="City")return {...chart,source:"CityRate",billingMethod:"Fixed + Overtime",baseRate:chart.tripRate,baseHours:8,applyOvertime:true};
 const band=input.distanceBand;if(!["0-50","50-150","Above 150"].includes(band))throw new AppError("Select a distance service band");
 const above=band==="Above 150",pnq=input.site==="PNQ";
 if(above && !(input.distanceKm>150))throw new AppError("Enter the actual distance above 150 KM");
 if(!above && input.distanceKm>0 && (band==="0-50"?input.distanceKm>50:input.distanceKm<=50||input.distanceKm>150))throw new AppError("Distance does not match the selected band");
 return {...chart,source:"TripRate",billingMethod:above?"Per KM":"Fixed + Overtime",baseRate:above?0:band==="0-50"?chart.upTo50:chart.upTo150,perKmRate:above?chart.above150:0,baseHours:above&&pnq?16:8,overtimeRate:above?(pnq?chart.pnqOvertimeRate:0):chart.overtimeRate,applyOvertime:!above||pnq};
}
