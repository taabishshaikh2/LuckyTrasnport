import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model });
const common = {
  archived: { type: Boolean, default: false },
  createdBy: ref("User"),
  updatedBy: ref("User"),
  referenceVersion: { type: Number, default: 0 },
};
const make = (name, fields, setup) => {
  const s = new Schema(fields, { timestamps: true, strict: true });
  setup?.(s);
  return mongoose.model(name, s);
};
export const User = make("User", {
  name: String,
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, select: false, required: true },
  role: { type: String, enum: ["ADMIN", "MANAGER", "DRIVER"], required: true },
  active: { type: Boolean, default: true },
  driverId: ref("Driver"),
});
User.schema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});
export const Vehicle = make("Vehicle", {
  ...common,
  vehicleId: { type: String, unique: true },
  vehicleNumber: { type: String, unique: true, required: true },
  vehicleType: String,
  customVehicleType: String,
  shiftHours:Number, branded:{type:Boolean,default:false},
  capacity: String,
  status: { type: String, default: "Active" },
  notes: String,
});
export const Agreement = make("Agreement", {
  ...common, agreementId: { type: String, unique: true }, name: String,
  vehicleId: ref("Vehicle"), customerId: ref("Customer"), site: String, fleetRateId: ref("FleetRate"),
  effectiveFrom: Date, effectiveTo: Date, deploymentDate: Date, contractYear: Number,
  shiftHours: Number, fixedKm: Number, fixedRate: Number, mileage: Number, fuelType: String,
  fuelRate: Number, amcRate: Number, serviceRate: Number, overtimeRate: Number,
  managementMonthly: Number, parkingMonthly: Number, airportEntryRate: Number,
  airportTaxable: { type: Boolean, default: false }, active: { type: Boolean, default: true }, notes: String,
});
export const FleetManager = make("FleetManager", {
  ...common,managerId:{type:String,unique:true},name:String,customerId:ref("Customer"),site:String,
  monthlySalary:Number,active:{type:Boolean,default:true},notes:String,
});
export const ShiftSettings = make("ShiftSettings", {
  _id:{type:String,default:"shifts"},entries:[{_id:false,hours:Number,monthlyKm:Number}],
  referenceVersion:{type:Number,default:0},archived:{type:Boolean,default:false},updatedBy:ref("User"),
});
export const TripRate = make("TripRate", {
  ...common, rateId:{type:String,unique:true}, vehicleType:{type:String,required:true},
  upTo50:Number,upTo150:Number,above150:Number,overtimeRate:Number,
  active:{type:Boolean,default:true},
}, s=>s.index({vehicleType:1},{unique:true,partialFilterExpression:{archived:false,active:true}}));
export const FleetRate = make("FleetRate", {
  ...common, rateId: {type:String,unique:true}, name:String, customerId:ref("Customer"), site:String,
  vehicleType:String, shiftHours:Number, fixedRate:Number, serviceRate:Number, amcRate:Number,
  effectiveFrom:Date, effectiveTo:Date, active:{type:Boolean,default:true}, notes:String,
});
export const FuelCharge = make("FuelCharge", {
  ...common, chargeId:{type:String,unique:true}, name:String, vehicleId:ref("Vehicle"), customerId:ref("Customer"), site:String,
  periodFrom:Date, periodTo:Date, mileage:Number, fuelRate:Number, fuelType:String, notes:String,
});
export const VehicleExpense = make("VehicleExpense", {
  ...common, chargeId:{type:String,unique:true}, name:String, vehicleId:ref("Vehicle"), customerId:ref("Customer"), site:String,
  date:Date, category:String, quantity:Number, rate:Number, notes:String,
});
export const AirportExpense = make("AirportExpense", {
  ...common, chargeId:{type:String,unique:true}, name:String, vehicleId:ref("Vehicle"), customerId:ref("Customer"), site:String,
  date:Date, quantity:Number, rate:Number, notes:String,
});
export const BillingClaim = make("BillingClaim", {
  key: { type: String, unique: true }, invoiceId: ref("Invoice"),
});
export const Driver = make("Driver", {
  ...common,
  driverId: { type: String, unique: true },
  fullName: String,
  phone: String,
  licenseNumber: String,
  licenseExpiry: Date,
  age: Number,
  experienceYears: Number,
  address: String,
  status: { type: String, default: "Active" },
  assignedVehicleId: ref("Vehicle"),
  notes: String,
});
export const Customer = make("Customer", {
  ...common,
  customerId: { type: String, unique: true },
  companyName: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  city: String,
  state: String,
  stateCode: String,
  gstin: String,
  dhlGstin: String,
  creditDays: { type: Number, default: 30 },
  openingBalance: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  notes: String,
});
export const Route = make("Route", {
  ...common,
  routeId: { type: String, unique: true },
  routeName: String,
  pickupLocation: String,
  dropLocation: String,
  category: String,
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  notes: String,
});
export const Rate = make("Rate", {
  ...common,
  rateId: { type: String, unique: true },
  routeId: ref("Route"),
  vehicleType: String,
  minKm: Number,
  maxKm: Number,
  minExclusive: Boolean,
  baseHours: Number,
  baseRate: Number,
  perKmRate: Number,
  perHourRate: Number,
  overtimeRate: Number,
  billingMethod: String,
  effectiveFrom: Date,
  effectiveTo: Date,
  active: { type: Boolean, default: true },
  notes: String,
});
const entry = new Schema(
  {
    awbNumber: String, customerName: String, sdcCharges: Number,
    openingKm: Number, closingKm: Number, additionalKm: Number, additionalServices: Number,
    airportEntries: Number, fuelLitres: Number,
    challanNumber: String,
    huNumber: String,
    billingGroup: String,
    closingDate: String,
    overtimeKm: Number,
    tripCharges: Number,
    tollParking: Number,
    totalServiceCharges: Number,
    srNo: Number,
    date: Date,
    vehicleNo: String,
    chaName: String,
    vehicleType: String,
    openingTime: String,
    mrbArrivalTime: String,
    closingTime: String,
    perTripHours: Number,
    totalHours: Number,
    gtInHours: Number,
    gtAmount: Number,
    distanceKm: Number,
    pickupLocation: String,
    dropLocation: String,
    remarks: String,
  },
  { _id: false },
);
export const Trip = make(
  "Trip",
  {
    site: String, dutyKind: { type: String, default: "Adhoc" },
    tripId: { type: String, unique: true },
    customerId: ref("Customer"),
    vehicleId: ref("Vehicle"),
    driverId: ref("Driver"),
    routeId: ref("Route"),
    tripType: String,
    pickupLocation: String,
    dropLocation: String,
    vehicleType: String,
    vehicleNumber: String,
    periodFrom: Date,
    periodTo: Date,
    distanceKm: Number,
    totalHours: Number,
    billingMethod: String,
    ratePerTrip: Number,
    perKmRate: Number,
    perHourRate: Number,
    overtimeRate: Number,
    baseDutyHours: Number,
    baseAmount: Number,
    overtimeHours: Number,
    overtimeAmount: Number,
    extraAmount: Number,
    deductionAmount: Number,
    subtotal: Number,
    totalAmount: Number,
    calculation: Schema.Types.Mixed,
    rateSnapshot: Schema.Types.Mixed,
    override: Schema.Types.Mixed,
    entries: [entry],
    status: { type: String, default: "Draft" },
    operationalCompleted: { type: Boolean, default: false },
    notes: String,
    source: String,
    importFingerprint: String,
    importSource: Schema.Types.Mixed,
    manualAmount: Number,
    overrideAmount: Number,
    overrideReason: String,
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  (s) => {
    s.index({ periodFrom: 1, status: 1, customerId: 1 });
    s.index(
      { importFingerprint: 1 },
      {
        unique: true,
        partialFilterExpression: { importFingerprint: { $type: "string" } },
      },
    );
  },
);
export const Invoice = make(
  "Invoice",
  {
    billingType: { type: String, default: "Adhoc" }, site: String,
    supportingTripIds: [ref("Trip")], vehicleIds: [ref("Vehicle")],
    narration: Schema.Types.Mixed, lineItems: [Schema.Types.Mixed],
    tripSnapshot: [Schema.Types.Mixed], nonTaxableAmount: Number,
    reviewToken: String,
    invoiceNumber: { type: String, unique: true },
    invoiceDate: Date,
    dueDate: Date,
    customerId: ref("Customer"),
    tripIds: [ref("Trip")],
    invoicedTo: String,
    billingAddress: String,
    periodFrom: Date,
    periodTo: Date,
    location: String,
    gstin: String,
    dhlGstin: String,
    sacNo: String,
    state: String,
    stateCode: String,
    placeOfSupply: String,
    invoiceMonth: String,
    description: String,
    baseAmount: Number,
    cgstRate: Number,
    sgstRate: Number,
    igstRate: Number,
    cgstAmount: Number,
    sgstAmount: Number,
    igstAmount: Number,
    roundOff: Number,
    totalAmount: Number,
    amountInWords: String,
    status: { type: String, default: "Pending" },
    receivedGuard: { type: Number, default: 0 },
    companySnapshot: Schema.Types.Mixed,
    cancellationReason: String,
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  (s) => {
    s.index({ status: 1, invoiceDate: 1 });
    s.index(
      { tripIds: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: { $in: ["Pending", "Partially Paid", "Paid", "Overdue"] },
          "tripIds.0": { $exists: true },
        },
      },
    );
  },
);
export const Payment = make("Payment", {
  paymentId: { type: String, unique: true },
  invoiceId: ref("Invoice"),
  customerId: ref("Customer"),
  paymentDate: Date,
  amount: Number,
  paymentMode: String,
  referenceNumber: String,
  notes: String,
  recordedBy: ref("User"),
});
export const Counter = mongoose.model(
  "Counter",
  new Schema({ _id: String, value: { type: Number, default: 0 } }),
);
export const ImportBatch = make("ImportBatch", {
  originalFilename: String,
  importedBy: ref("User"),
  importedAt: Date,
  hash: { type: String, unique: true },
  headers: [String],
  rows: [Schema.Types.Mixed],
  mapping: Schema.Types.Mixed,
  rowCount: Number,
  successfulRows: Number,
  failedRows: Number,
  tripId: ref("Trip"),
  tripIds: [ref("Trip")],
  selectedSheet: String,
  sheetNames: [String],
  confirmed: { type: Boolean, default: false },
});
export const Audit = make("Audit", {
  entity: String,
  entityId: Schema.Types.ObjectId,
  previousValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  reason: String,
  changedBy: ref("User"),
});
export const masters = {
  fleetManagers: FleetManager, tripRates: TripRate, agreements: Agreement, fleetRates: FleetRate, fuelCharges: FuelCharge, vehicleExpenses: VehicleExpense, airportExpenses: AirportExpense,
  vehicles: Vehicle,
  drivers: Driver,
  customers: Customer,
  routes: Route,
  rates: Rate,
};

export const CompanyProfile = mongoose.model(
  "CompanyProfile",
  new Schema(
    {
      _id: { type: String, default: "company" },
      name: String,
      address: String,
      phone: String,
      email: String,
      gstin: String,
      pan: String,
      stateCode: String,
      bankName: String,
      bankAccount: String,
      bankIfsc: String,
      tagline: String,
      disputeClause: String,
      interestClause: String,
      paymentClause: String,
      updatedBy: ref("User"),
    },
    { timestamps: true },
  ),
);
