import { z } from "zod";
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
export const masterSchemas = {
  vehicles: z.object({
    vehicleNumber: required.transform((v) =>
      v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ),
    vehicleType: required,
    customVehicleType: optional,
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
export const invoiceSchema = z
  .object({
    customerId: id,
    tripIds: z
      .array(id)
      .min(1)
      .max(100)
      .refine((v) => new Set(v).size === v.length, "Duplicate trip selection"),
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
  );
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
