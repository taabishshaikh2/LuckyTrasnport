import { z } from "zod";
import { sites } from "../../shared/sites.js";
const site = z.enum([...sites.map(s => s.value),"Branded"]);
const str = z.string().trim();
const required = str.min(1).max(250);
const optional = str.max(2000).optional().default("");
export const id = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Select a valid record");
const optId = z
  .union([id, z.literal("")])
  .optional()
  .transform((v) => v || undefined);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
const optDate = z
  .union([date, z.literal("")])
  .optional()
  .transform((v) => v || undefined);
const num = z.coerce.number().finite().min(0).max(1e9);
const n = num.optional().default(0);
const phone = z
  .union([str.regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone"), z.literal("")])
  .optional();
const gst = z
  .union([
    str.regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Invalid GSTIN",
    ),
    z.literal(""),
  ])
  .optional();
export const methods = [
  "Fixed Trip Rate",
  "Per KM",
  "Per Hour",
  "Fixed + Overtime",
  "Mutually Agreed / Manual",
];
const clock=str.regex(/^([01]\d|2[0-3]):[0-5]\d$/,"Enter a valid time");
export const masterSchemas = {
 brandedLogs:z.object({customerId:id,vehicleId:id,date,openingKm:n,closingKm:n,openingTime:clock,closingTime:clock,held:z.boolean().default(false),holdLocation:optional,airportFee:n}).transform(v=>{
  const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const minutes=(minute(v.closingTime)-minute(v.openingTime)+1440)%1440;
  return {...v,name:v.date+" "+v.openingTime,distanceKm:v.held?0:v.closingKm-v.openingKm,totalHours:minutes/60};
 }).refine(v=>v.totalHours===8,"Each branded log must be one 8-hour shift").refine(v=>v.held || v.closingKm>=v.openingKm,"Closing KM must not be less than opening KM").refine(v=>!v.held || !!v.holdLocation,"Enter the loading / hold location"),
 weeklyOffs:z.object({customerId:id,vehicleId:id,date,notes:optional}).transform(v=>({...v,name:v.date})),
  fleetManagers:z.object({name:required,customerId:id,site,monthlySalary:num.positive(),active:z.boolean().default(true),notes:optional}),
  tripRates:z.object({vehicleType:required,upTo50:num,upTo150:num,above150:num,overtimeRate:num,active:z.boolean().default(true)}),
  fleetRates: z.object({name:required,customerId:id,site,vehicleType:required,
    shiftHours:num.positive().max(168),fixedRate:num.positive(),serviceRate:n,amcRate:n,
    effectiveFrom:date,effectiveTo:optDate,active:z.boolean().default(true),notes:optional,
  }).refine(v=>!v.effectiveTo || v.effectiveTo>=v.effectiveFrom,"Effective end must follow start"),
  fuelCharges: z.object({name:required,vehicleId:id,customerId:id,site,periodFrom:date,periodTo:date,
    mileage:num.positive(),fuelRate:num.positive(),fuelType:z.enum(["Diesel","CNG","Petrol"]),notes:optional,
  }).refine(v=>v.periodTo>=v.periodFrom,"Period end must follow start"),
  vehicleExpenses: z.object({name:required,vehicleId:id,customerId:id,site,date,
    category:z.enum(["Toll","Entry","Parking"]),quantity:num.positive(),rate:num.positive(),notes:optional}),
  airportExpenses: z.object({name:required,vehicleId:id,customerId:id,site,date,quantity:num.positive(),rate:num.positive(),notes:optional}),
  agreements: z.object({
    name: required, vehicleId: id, customerId: id, site, fleetRateId:optId,
    effectiveFrom: date, effectiveTo: optDate, deploymentDate: optDate,
    contractYear: num.min(1).max(30).default(1), shiftHours: z.coerce.number().refine(v => [8,16,24].includes(v)),
    fixedKm: num.positive().default(3000), fixedRate: n, mileage: num.positive().default(1),
    fuelType: z.enum(["Diesel", "CNG", "Petrol"]).default("Diesel"), fuelRate: n, amcRate: n,
    serviceRate: n, overtimeRate: n, managementMonthly: n, parkingMonthly: n,
    airportEntryRate: n, airportTaxable: z.boolean().default(false),
    active: z.boolean().default(true), notes: optional,
  }).refine(v => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, "Effective end must follow start"),
  vehicles: z.object({
    vehicleNumber: required.transform((v) =>
      v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ),
    vehicleType: required,
    customVehicleType: optional,
    shiftHours:z.union([num.positive().max(168),z.literal("")]).optional().transform(v=>v===""?undefined:v), branded:z.boolean().default(false),
    adcRate:n,amcRate:n,parkingMonthly:n,tollEntryMonthly:n,
    capacity: optional,
    status: z
      .enum(["Active", "On Trip", "Maintenance", "Inactive"])
      .default("Active"),
    notes: optional,
  }),
  drivers: z.object({
    fullName: required,
    phone,
    licenseNumber: optional,
    licenseExpiry: optDate,
    age: num.max(100).optional(),
    experienceYears: num.max(80).optional(),
    address: optional,
    status: z
      .enum(["Active", "On Trip", "On Leave", "Inactive"])
      .default("Active"),
    assignedVehicleId: optId,
    notes: optional,
  }),
  customers: z.object({
    companyName: required,
    contactPerson: optional,
    phone,
    email: z.union([str.email(), z.literal("")]).optional(),
    address: optional,
    city: optional,
    state: optional,
    stateCode: str.regex(/^\d{2}$/),
    gstin: gst,
    dhlGstin: gst,
    creditDays: num.max(365).default(30),
    openingBalance: n,
    active: z.boolean().default(true),
    notes: optional,
  }),
  routes: z.object({
    routeName: required,
    pickupLocation: required,
    dropLocation: required,
    category: z.enum(["Inbound", "Outbound", "Regular", "Special"]),
    active: z.boolean().default(true),
    order: n,
    notes: optional,
  }),
  rates: z
    .object({
      routeId: id,
      vehicleType: required,
      minKm: n,
      maxKm: num.nullable().optional().default(null),
      minExclusive: z.boolean().default(false),
      baseHours: num.default(12),
      baseRate: n,
      perKmRate: n,
      perHourRate: n,
      overtimeRate: n,
      billingMethod: z.enum(methods),
      effectiveFrom: date,
      effectiveTo: optDate,
      active: z.boolean().default(true),
      notes: optional,
    })
    .refine(
      (v) => v.maxKm == null || v.maxKm >= v.minKm,
      "Maximum KM must exceed minimum",
    )
    .refine(
      (v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom,
      "Effective end must follow start",
    ),
};
const time = z
  .union([str.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"), z.literal("")])
  .optional();
export const entrySchema = z.object({
  awbNumber: optional, customerName: optional, sdcCharges: n,
  openingKm: n, closingKm: n, additionalKm: n, additionalServices: n,
  airportEntries: n, fuelLitres: n,
  challanNumber: optional,
  huNumber: optional,
  billingGroup: optional,
  closingDate: optional,
  overtimeKm: n,
  tripCharges: n,
  tollParking: n,
  totalServiceCharges: n,
  srNo: num.optional(),
  date,
  vehicleNo: optional,
  chaName: optional,
  vehicleType: optional,
  openingTime: time,
  mrbArrivalTime: time,
  closingTime: time,
  perTripHours: n,
  totalHours: n,
  gtInHours: n,
  gtAmount: n,
  distanceKm: n,
  pickupLocation: optional,
  dropLocation: optional,
  remarks: optional,
});
export const tripSchema = z
  .object({
    site: site.optional(), dutyKind: z.enum(["Adhoc", "Branded"]).default("Adhoc"),
    customerId: id,
    vehicleId: id,
    driverId: optId,
    routeId: id,
    periodFrom: date,
    periodTo: date,
    distanceKm: n,
    totalHours: n,
    extraAmount: n,
    deductionAmount: n,
    pickupLocation: optional,
    dropLocation: optional,
    manualAmount: num.optional(),
    overrideAmount: num.optional(),
    overrideReason: optional,
    notes: optional,
    entries: z.array(entrySchema).max(2000).default([]),
    status: z.enum(["Draft", "Submitted"]).default("Draft"),
    expectedTotal: num.optional(),
  })
  .refine((v) => v.periodTo >= v.periodFrom, "Period end must follow start");
export const periodChargeSchema = z.object({
  description: required, amount: num, taxable: z.boolean().default(true),
  allocationNote: required,
});
const vehicleMetrics = z.object({
  vehicleId: id, shiftHours:num.positive().max(168).optional(), distanceKm: num.optional(), fuelRate: num.optional(),
  additionalServices: num.optional(), overtimeHours: num.optional(), airportEntries: num.optional(),
  fuelLitres: num.optional(), extraFuelRate: num.optional(), fixedFraction: num.max(1).optional(),
  parkingFraction: num.max(1).optional(), managementFraction: num.max(1).optional(),
  reason: optional,
});
export const invoiceSchema = z
  .object({
    customerId: id,
    billingType: z.enum(["Fixed", "Variable", "Adhoc"]).default("Adhoc"),
    site: site.optional(), periodFrom: optDate, periodTo: optDate,
    vehicleIds: z.array(id).max(100).default([]).refine(v => new Set(v).size === v.length, "Duplicate vehicle selection"),
    managerIds:z.array(id).max(100).default([]).refine(v=>new Set(v).size===v.length,"Duplicate manager selection"),
    metrics: z.array(vehicleMetrics).max(100).default([]).refine(v => new Set(v.map(m => m.vehicleId)).size === v.length, "Duplicate vehicle metrics"),
    periodCharges: z.array(periodChargeSchema).max(100).default([]),
    tripIds: z
      .array(id)
      .max(2000)
      .refine((v) => new Set(v).size === v.length, "Duplicate trip selection").default([]),
    invoiceDate: date,
    dueDate: date,
    stateCode: str.regex(/^\d{2}$/),
    placeOfSupply: required,
    sacNo: str.regex(/^\d{6}$/).default("996601"),
    cgstRate: num.max(100).default(0),
    sgstRate: num.max(100).default(0),
    igstRate: num.max(100).default(0),
    description: optional,
    roundToRupee: z.boolean().default(true),
    taxConfirmed: z.literal(true),
  })
  .refine(
    (v) => v.dueDate >= v.invoiceDate,
    "Due date must follow invoice date",
  ).refine(v => !v.periodFrom || !v.periodTo || v.periodTo >= v.periodFrom, "Period end must follow start")
  .refine(v => v.billingType === "Adhoc" ? v.tripIds.length > 0 : !!(v.site && v.periodFrom && v.periodTo && v.vehicleIds.length), "Select trips for Adhoc, or site, period and vehicles for fleet billing");
export const paymentSchema = z.object({
  invoiceId: id,
  paymentDate: date,
  amount: num.positive(),
  paymentMode: z.enum(["Cash", "Bank Transfer", "UPI", "Cheque", "Other"]),
  referenceNumber: optional,
  notes: optional,
});
export const userSchema = z
  .object({
    name: required,
    username: str.min(3).max(60),
    password: z.string().min(10).max(100).optional(),
    role: z.enum(["ADMIN", "MANAGER", "DRIVER"]),
    driverId: optId,
    active: z.boolean().default(true),
  })
  .refine(
    (v) => v.role !== "DRIVER" || !!v.driverId,
    "Driver accounts require a driver record",
  );
