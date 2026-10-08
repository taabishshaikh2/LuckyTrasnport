import Decimal from "decimal.js";
import { AppError } from "../utils/errors.js";
export const vehicleRateType = vehicle => vehicle.vehicleType === "Custom" ? vehicle.customVehicleType || "Custom" : vehicle.vehicleType;
export function distanceRate(chart, distanceKm, includedHours=8) {
  if (!Number.isFinite(distanceKm) || distanceKm<0 || !Number.isFinite(includedHours) || includedHours<=0) throw new AppError("Enter a valid distance and included duty hours");
  const perKm=distanceKm>150;
  return {...chart,source:"TripRate",billingMethod:perKm ? "Per KM" : "Fixed + Overtime",
    baseRate:perKm ? 0 : distanceKm<=50 ? chart.upTo50 : chart.upTo150,
    perKmRate:perKm ? chart.above150 : 0,baseHours:includedHours,
    minKm:distanceKm<=50 ? 0 : distanceKm<=150 ? 50 : 150,maxKm:distanceKm<=50 ? 50 : distanceKm<=150 ? 150 : null,
    minExclusive:distanceKm>50,applyOvertime:true};
}
export function tripChargeTotal(records) {
  return records.reduce((n,t)=>n.add(t.rateSnapshot?.source === "TripRate" ? t.totalAmount || 0 :
    (t.entries || []).reduce((sum,e)=>sum.add(e.sdcCharges || e.tripCharges || 0),new Decimal(0))),new Decimal(0)).toNumber();
}
