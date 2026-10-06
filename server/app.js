import "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { auth, operations } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import masterRoutes from "./routes/masters.js";
import tripRoutes from "./routes/trips.js";
import invoiceRoutes, { paymentsRouter } from "./routes/invoices.js";
import importRoutes from "./routes/imports.js";
import exportRoutes from "./routes/exports.js";
import { Trip, Vehicle, Invoice, Customer } from "./models/index.js";
import { invoiceBalance } from "./services/paymentService.js";
import { company } from "./config/env.js";
import { wrap, ok, errorHandler, AppError } from "./utils/errors.js";
export const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (process.env.FRONTEND_URL || "http://localhost:5173")
        .split(",")
        .map((v) => v.trim());
      callback(
        origin && !allowed.includes(origin)
          ? new AppError("Origin not allowed", 403)
          : null,
        !origin || allowed.includes(origin),
      );
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    data: { status: connected ? "ready" : "database unavailable" },
  });
});
app.use("/api/auth", authRoutes);
app.use("/api", auth);
app.get("/api/settings", operations, (req, res) => ok(res, company()));
app.get(
  "/api/dashboard",
  operations,
  wrap(async (req, res) => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoices = await Invoice.find({ status: { $ne: "Cancelled" } });
    const balances = await Promise.all(invoices.map((i) => invoiceBalance(i)));
    ok(res, {
      activeVehicles: await Vehicle.countDocuments({
        archived: false,
        status: { $in: ["Active", "On Trip"] },
      }),
      tripsThisMonth: await Trip.countDocuments({
        periodFrom: { $gte: month },
        status: { $ne: "Cancelled" },
      }),
      pendingInvoices: balances.filter((b) => b.outstanding > 0).length,
      outstanding: balances.reduce((s, b) => s + b.outstanding, 0),
      recentTrips: await Trip.find()
        .populate("customerId", "companyName")
        .sort({ createdAt: -1 })
        .limit(5),
      recentInvoices: invoices.slice(-5).reverse(),
    });
  }),
);
app.get(
  "/api/customer-balances",
  operations,
  wrap(async (req, res) => {
    const customers = await Customer.find({ archived: false });
    const invoices = await Invoice.find({ status: { $ne: "Cancelled" } });
    const output = [];
    for (const c of customers) {
      const rows = invoices.filter(
        (i) => String(i.customerId) === String(c._id),
      );
      const balances = await Promise.all(rows.map((i) => invoiceBalance(i)));
      const billed = rows.reduce((s, i) => s + i.totalAmount, 0),
        received = balances.reduce((s, b) => s + b.received, 0);
      output.push({
        customerId: c._id,
        companyName: c.companyName,
        openingBalance: c.openingBalance,
        totalBilled: billed,
        totalReceived: received,
        outstanding: c.openingBalance + billed - received,
      });
    }
    ok(res, output);
  }),
);
app.use("/api/masters", masterRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentsRouter);
app.use("/api/imports", importRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api", (req, res, next) =>
  next(new AppError("API route not found", 404)),
);
const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist",
);
app.use(express.static(dist));
app.get("*", (req, res, next) =>
  res.sendFile(
    path.join(dist, "index.html"),
    (err) => err && next(new AppError("Frontend build unavailable", 404)),
  ),
);
app.use(errorHandler);
