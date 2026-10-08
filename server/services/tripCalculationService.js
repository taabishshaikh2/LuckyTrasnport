import Decimal from "decimal.js";
import { AppError } from "../utils/errors.js";
export const money = (v) =>
  new Decimal(v || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export function matchesRate(
  rate,
  { routeId, vehicleType, distanceKm, periodFrom },
) {
  const day = new Date(periodFrom);
  return (
    rate.active !== false &&
    !rate.archived &&
    String(rate.routeId) === String(routeId) &&
    rate.vehicleType === vehicleType &&
    (rate.minExclusive ? distanceKm > rate.minKm : distanceKm >= rate.minKm) &&
    (rate.maxKm == null || distanceKm <= rate.maxKm) &&
    day >= new Date(rate.effectiveFrom) &&
    (!rate.effectiveTo || day <= new Date(rate.effectiveTo))
  );
}
export function selectRate(rates, input) {
  const found = rates.filter((r) => matchesRate(r, input));
  if (found.length !== 1)
    throw new AppError(
      found.length
        ? "Overlapping rate rules. Ask Admin to correct the rate chart"
        : "No applicable rate. Configure a rate for this route, vehicle, distance and date",
    );
  return found[0];
}
export function calculateTrip(input, rate) {
  for (const key of [
    "distanceKm",
    "totalHours",
    "extraAmount",
    "deductionAmount",
  ])
    if (
      !Number.isFinite(Number(input[key] || 0)) ||
      Number(input[key] || 0) < 0
    )
      throw new AppError("Invalid " + key);
  const d = (v) => new Decimal(v || 0);
  let base;
  let overtimeHours = 0;
  switch (rate.billingMethod) {
    case "Per KM":
      base = d(input.distanceKm).mul(rate.perKmRate);
      break;
    case "Per Hour":
      base = d(input.totalHours).mul(rate.perHourRate);
      break;
    case "Fixed + Overtime":
      base = d(rate.baseRate);
      overtimeHours = Math.max(0, (input.totalHours || 0) - rate.baseHours);
      break;
    case "Fixed Trip Rate":
      base = d(rate.baseRate);
      break;
    case "Mutually Agreed / Manual":
      if (input.manualAmount == null || !input.overrideReason?.trim())
        throw new AppError("Enter the agreed amount and reason");
      base = d(input.manualAmount);
      break;
    default:
      throw new AppError("Unsupported billing method");
  }
  if (rate.applyOvertime) overtimeHours = Math.max(0, (input.totalHours || 0) - rate.baseHours);
  const overtime = d(overtimeHours).mul(rate.overtimeRate);
  const original = money(base.add(overtime));
  const override = input.overrideAmount != null;
  if (override && !input.overrideReason?.trim())
    throw new AppError("A rate override requires a reason");
  const final = override ? money(input.overrideAmount) : original;
  const totalAmount = money(
    d(final)
      .add(input.extraAmount || 0)
      .sub(input.deductionAmount || 0),
  );
  if (totalAmount < 0) throw new AppError("Deductions exceed trip charges");
  return {
    billingMethod: rate.billingMethod,
    ratePerTrip: rate.baseRate,
    perKmRate: rate.perKmRate,
    perHourRate: rate.perHourRate,
    overtimeRate: rate.overtimeRate,
    baseDutyHours: rate.baseHours,
    baseAmount: money(base),
    overtimeHours,
    overtimeAmount: money(overtime),
    extraAmount: money(input.extraAmount),
    deductionAmount: money(input.deductionAmount),
    subtotal: final,
    totalAmount,
    originalCalculatedRate: original,
    finalRate: final,
    explanation: {
      distanceKm: input.distanceKm,
      totalHours: input.totalHours,
      minKm: rate.minKm,
      maxKm: rate.maxKm,
      minExclusive: rate.minExclusive,
      baseHours: rate.baseHours,
      baseRate: rate.baseRate,
      perKmRate: rate.perKmRate,
      perHourRate: rate.perHourRate,
      overtimeRate: rate.overtimeRate,
      billingMethod: rate.billingMethod,
    },
  };
}
