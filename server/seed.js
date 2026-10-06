import "./config/env.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  Vehicle,
  Driver,
  Customer,
  Route,
  Rate,
} from "./models/index.js";
import { sequence } from "./services/sequenceService.js";
import { transaction } from "./services/transactionService.js";
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEV_SEED !== "true"
)
  throw new Error(
    "Seed requires NODE_ENV != production and ALLOW_DEV_SEED=true",
  );
if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
try {
  await transaction(async (s) => {
    const users = [];
    for (const [username, password, role] of [
      ["admin", "admin123", "ADMIN"],
      ["manager", "manager123", "MANAGER"],
      ["driver1", "driver123", "DRIVER"],
    ]) {
      let u = await User.findOne({ username }).session(s);
      if (!u) {
        [u] = await User.create(
          [
            {
              name:
                username === "admin"
                  ? "Administrator"
                  : username === "manager"
                    ? "Operations Manager"
                    : "Rajesh Kumar",
              username,
              passwordHash: await bcrypt.hash(password, 12),
              role,
            },
          ],
          { session: s },
        );
      }
      users.push(u);
    }
    const vehicles = [];
    for (const [vehicleNumber, vehicleType] of [
      ["MH02AB1234", "8 FT"],
      ["MH02CD5678", "14 FT"],
      ["MH04EF9012", "17 FT"],
      ["MH03GH3456", "20 FT"],
    ]) {
      let v = await Vehicle.findOne({ vehicleNumber }).session(s);
      if (!v) {
        [v] = await Vehicle.create(
          [
            {
              vehicleId: await sequence("vehicles", "V", s),
              vehicleNumber,
              vehicleType,
              status: "Active",
              createdBy: users[0]._id,
            },
          ],
          { session: s },
        );
      }
      vehicles.push(v);
    }
    const drivers = [];
    for (const [i, fullName] of [
      "Rajesh Kumar",
      "Suresh Patil",
      "Imran Shaikh",
    ].entries()) {
      let d = await Driver.findOne({ fullName }).session(s);
      if (!d) {
        [d] = await Driver.create(
          [
            {
              driverId: await sequence("drivers", "D", s),
              fullName,
              phone: "900000000" + i,
              status: "Active",
              assignedVehicleId: vehicles[i]._id,
            },
          ],
          { session: s },
        );
      }
      drivers.push(d);
    }
    if (!users[2].driverId) {
      users[2].driverId = drivers[0]._id;
      await users[2].save({ session: s });
    }
    for (const companyName of [
      "DHL Express",
      "Sample Cargo Ltd",
      "Sample Logistics Pvt Ltd",
      "Sample Freight Services",
    ])
      if (!(await Customer.exists({ companyName }).session(s)))
        await Customer.create(
          [
            {
              customerId: await sequence("customers", "C", s),
              companyName,
              city: "Mumbai",
              state: "Maharashtra",
              stateCode: "27",
              creditDays: 30,
              openingBalance: 0,
            },
          ],
          { session: s },
        );
    for (const [routeName, pickupLocation, category] of [
      ["Inbound MIDC → Cargo", "MIDC", "Inbound"],
      ["Outbound Marwah → Cargo", "Marwah", "Outbound"],
      ["Goregaon → Cargo", "Goregaon", "Regular"],
      ["Vidhya Vihar → Cargo", "Vidhya Vihar", "Regular"],
      ["Special", "Custom pickup", "Special"],
    ]) {
      let route = await Route.findOne({ routeName }).session(s);
      if (!route) {
        [route] = await Route.create(
          [
            {
              routeId: await sequence("routes", "R", s),
              routeName,
              pickupLocation,
              dropLocation: "Cargo",
              category,
            },
          ],
          { session: s },
        );
      }
      for (const vehicleType of ["8 FT", "9 FT", "14 FT", "17 FT", "20 FT"])
        for (const [minKm, maxKm, minExclusive, multiplier] of [
          [0, 50, false, 1],
          [50, 150, true, 1.5],
          [150, null, true, 2],
        ])
          if (
            !(await Rate.exists({
              routeId: route._id,
              vehicleType,
              minKm,
            }).session(s))
          )
            await Rate.create(
              [
                {
                  rateId: await sequence("rates", "RATE-", s),
                  routeId: route._id,
                  vehicleType,
                  minKm,
                  maxKm,
                  minExclusive,
                  baseHours: 12,
                  baseRate: 4000 * multiplier,
                  perKmRate: 40,
                  perHourRate: 350,
                  overtimeRate: 250,
                  billingMethod:
                    category === "Special"
                      ? "Mutually Agreed / Manual"
                      : "Fixed + Overtime",
                  effectiveFrom: "2026-01-01",
                  active: true,
                  notes: "ILLUSTRATIVE ONLY — replace using real rate chart",
                },
              ],
              { session: s },
            );
    }
  });
  console.log(
    "Development seed complete. Existing records/passwords were preserved.",
  );
} finally {
  await mongoose.disconnect();
}
