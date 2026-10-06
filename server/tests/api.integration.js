import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";
import XLSX from "xlsx";
import {
  User,
  Counter,
  Invoice,
  Payment,
  Vehicle,
  Trip,
} from "../models/index.js";
import { sequence } from "../services/sequenceService.js";
process.env.JWT_SECRET = "isolated-integration-test-secret-32-chars";
process.env.COMPANY_STATE_CODE = "27";
const { app } = await import("../app.js");
let mongo,
  token,
  manager,
  driver,
  refs = {},
  trip,
  invoice;
const get = (url) =>
  request(app)
    .get("/api" + url)
    .set("Authorization", "Bearer " + token);
const post = (url, data, t = token) =>
  request(app)
    .post("/api" + url)
    .set("Authorization", "Bearer " + t)
    .send(data);
before(
  async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { downloadDir: path.resolve("../../../work/mongo-binaries") },
    });
    await mongoose.connect(mongo.getUri("lucky_test"));
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    for (const [username, role] of [
      ["admin", "ADMIN"],
      ["manager", "MANAGER"],
      ["driver", "DRIVER"],
    ])
      await User.create({
        name: username,
        username,
        role,
        passwordHash: await bcrypt.hash("test-password-123", 4),
      });
    for (const username of ["admin", "manager", "driver"]) {
      const r = await request(app)
        .post("/api/auth/login")
        .send({ username, password: "test-password-123" });
      assert.equal(r.status, 200);
      if (username === "admin") token = r.body.data.token;
      if (username === "manager") manager = r.body.data.token;
      if (username === "driver") driver = r.body.data.token;
    }
  },
  { timeout: 240000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test(
  "API business workflow and concurrent integrity",
  { timeout: 120000 },
  async (t) => {
    await t.test("JWT authentication and roles", async () => {
      assert.equal((await request(app).get("/api/trips")).status, 401);
      assert.equal(
        (await post("/masters/users", { name: "Blocked" }, manager)).status,
        403,
      );
      assert.equal(
        (
          await request(app)
            .get("/api/invoices")
            .set("Authorization", "Bearer " + driver)
        ).status,
        403,
      );
      assert.equal((await post("/masters/routes", {}, manager)).status, 403);
    });
    await t.test(
      "company profile permissions, validation and persistence",
      async () => {
        const original = await get("/settings");
        assert.equal(original.status, 200);
        const profile = {
          ...original.body.data,
          name: "Profile Test Company",
          stateCode: "27",
          gstin: "",
          pan: "ABCDE1234F",
          phone: "9000000000",
          email: "billing@example.com",
          bankName: "Example Bank",
          bankAccount: "001234567890",
          bankIfsc: "ABCD0123456",
        };
        const patch = (data, auth = token) =>
          request(app)
            .patch("/api/settings")
            .set("Authorization", "Bearer " + auth)
            .send(data);
        assert.equal((await patch(profile, manager)).status, 403);
        assert.equal(
          (
            await request(app)
              .get("/api/settings")
              .set("Authorization", "Bearer " + driver)
          ).status,
          403,
        );
        assert.equal((await patch({ ...profile, pan: "invalid" })).status, 400);
        assert.equal(
          (await patch({ ...profile, bankIfsc: "invalid" })).status,
          400,
        );
        const saved = await patch(profile);
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        const read = await get("/settings");
        assert.equal(read.body.data.name, profile.name);
        assert.equal(read.body.data.bankAccount, "001234567890");
        const managerRead = await request(app)
          .get("/api/settings")
          .set("Authorization", "Bearer " + manager);
        assert.equal(managerRead.status, 200);
        const { Audit } = await import("../models/index.js");
        assert.equal(
          await Audit.countDocuments({ entity: "CompanyProfile" }),
          1,
        );
      },
    );
    await t.test("masters and normalized duplicate vehicle", async () => {
      const items = {
        vehicles: { vehicleNumber: "MH 02 AB 1234", vehicleType: "17 FT" },
        drivers: { fullName: "Test Driver", phone: "9000000000" },
        customers: {
          companyName: "DHL Express",
          stateCode: "27",
          state: "Maharashtra",
        },
        routes: {
          routeName: "MIDC to Cargo",
          pickupLocation: "MIDC",
          dropLocation: "Cargo",
          category: "Inbound",
        },
      };
      for (const [entity, data] of Object.entries(items)) {
        const r = await post("/masters/" + entity, data);
        assert.equal(r.status, 201, JSON.stringify(r.body));
        refs[entity] = r.body.data;
      }
      assert.equal(
        (
          await post("/masters/vehicles", {
            vehicleNumber: "mh02ab1234",
            vehicleType: "17 FT",
          })
        ).status,
        409,
      );
      const r = await post("/masters/rates", {
        routeId: refs.routes._id,
        vehicleType: "17 FT",
        minKm: 0,
        maxKm: 50,
        baseHours: 12,
        baseRate: 4000,
        overtimeRate: 250,
        billingMethod: "Fixed + Overtime",
        effectiveFrom: "2026-01-01",
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const u = await post("/masters/users", {
        name: "Assigned driver",
        username: "assigned",
        password: "test-password-123",
        role: "DRIVER",
        driverId: refs.drivers._id,
      });
      assert.equal(u.status, 201);
      assert.equal(u.body.data.passwordHash, undefined);
      const login = await request(app)
        .post("/api/auth/login")
        .send({ username: "assigned", password: "test-password-123" });
      driver = login.body.data.token;
    });
    await t.test("atomic sequence under concurrent writes", async () => {
      await Counter.create({ _id: "concurrent-test", value: 0 });
      const ids = await Promise.all(
        Array.from({ length: 30 }, () => sequence("concurrent-test", "TEST-")),
      );
      assert.equal(new Set(ids).size, 30);
      assert.equal((await Counter.findById("concurrent-test")).value, 30);
    });
    const input = () => ({
      customerId: refs.customers._id,
      vehicleId: refs.vehicles._id,
      driverId: refs.drivers._id,
      routeId: refs.routes._id,
      periodFrom: "2026-10-07",
      periodTo: "2026-10-07",
      distanceKm: 42,
      totalHours: 15,
      status: "Submitted",
      expectedTotal: 4750,
    });
    await t.test(
      "preview, create, reserve fleet and assigned access",
      async () => {
        const preview = await post("/trips/preview", input());
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.data.calculation.totalAmount, 4750);
        const r = await post("/trips", input());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        trip = r.body.data;
        assert.equal(
          (await Vehicle.findById(refs.vehicles._id)).status,
          "On Trip",
        );
        const own = await request(app)
          .get("/api/trips")
          .set("Authorization", "Bearer " + driver);
        assert.equal(own.body.data.length, 1);
        assert.equal((await post("/trips", input())).status, 409);
      },
    );
    await t.test("approve and invoice before completion", async () => {
      assert.equal(
        (await post("/trips/" + trip._id + "/status", { status: "Approved" }))
          .status,
        200,
      );
      const data = {
        customerId: refs.customers._id,
        tripIds: [trip._id],
        invoiceDate: "2026-10-07",
        dueDate: "2026-11-07",
        stateCode: "27",
        placeOfSupply: "Maharashtra",
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        taxConfirmed: true,
        expectedTotal: 5605,
      };
      const r = await post("/invoices", data);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      invoice = r.body.data;
      assert.equal(invoice.invoiceNumber, "INV/2026-27/001");
      assert.equal((await post("/invoices", data)).status, 400);
      assert.equal((await Trip.findById(trip._id)).status, "Invoiced");
      assert.equal((await post("/trips", input())).status, 409);
      assert.equal(
        (await post("/trips/" + trip._id + "/status", { status: "Completed" }))
          .status,
        200,
      );
      assert.equal((await Trip.findById(trip._id)).status, "Invoiced");
      assert.equal(
        (await Vehicle.findById(refs.vehicles._id)).status,
        "Active",
      );
    });
    await t.test("concurrent payments cannot exceed balance", async () => {
      const data = {
        invoiceId: invoice._id,
        paymentDate: "2026-10-08",
        amount: 4000,
        paymentMode: "UPI",
      };
      const result = await Promise.all([
        post("/payments", data),
        post("/payments", data),
      ]);
      assert.equal(
        result.filter((r) => r.status === 201).length,
        1,
        JSON.stringify(result.map((r) => r.body)),
      );
      assert.equal(await Payment.countDocuments({ invoiceId: invoice._id }), 1);
      let view = await get("/invoices/" + invoice._id);
      assert.equal(view.body.data.outstanding, 1605);
      assert.equal(view.body.data.status, "Partially Paid");
      assert.equal(
        (await post("/payments", { ...data, amount: 1605 })).status,
        201,
      );
      view = await get("/invoices/" + invoice._id);
      assert.equal(view.body.data.outstanding, 0);
      assert.equal(view.body.data.status, "Paid");
      assert.equal(
        (
          await post("/invoices/" + invoice._id + "/cancel", {
            reason: "Attempt cancellation",
          })
        ).status,
        400,
      );
    });
    await t.test(
      "company edits preserve finalized invoice snapshots",
      async () => {
        assert.equal(invoice.companySnapshot.name, "Profile Test Company");
        const profile = (await get("/settings")).body.data;
        const changed = await request(app)
          .patch("/api/settings")
          .set("Authorization", "Bearer " + token)
          .send({
            ...profile,
            name: "Renamed Company",
            bankAccount: "009999999999",
          });
        assert.equal(changed.status, 200, JSON.stringify(changed.body));
        const existing = (await get("/invoices/" + invoice._id)).body.data;
        assert.equal(existing.companySnapshot.name, "Profile Test Company");
        assert.equal(existing.companySnapshot.bankAccount, "001234567890");
        assert.equal(
          (await get("/settings")).body.data.name,
          "Renamed Company",
        );
      },
    );
    await t.test("authenticated binary downloads", async () => {
      for (const suffix of ["pdf", "docx"]) {
        const r = await get("/exports/invoices/" + invoice._id + "." + suffix);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.headers["content-disposition"].includes("attachment"));
      }
      assert.equal(
        (await get("/exports/trips.xlsx?tripId=" + trip._id)).status,
        200,
      );
      assert.equal(
        (await get("/exports/trips/" + trip._id + ".docx")).status,
        200,
      );
    });
    await t.test(
      "Excel preview, confirmation, duplicate prevention",
      async () => {
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          book,
          XLSX.utils.json_to_sheet([
            {
              Date: "2026-10-07",
              "Vehicle No": "MH02AB1234",
              "Total Hours": 15,
              KM: 42,
            },
            { Date: "bad", "Vehicle No": "OTHER", "Total Hours": -2, KM: 0 },
          ]),
          "Trips",
        );
        const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
        const upload = () =>
          request(app)
            .post("/api/imports/upload")
            .set("Authorization", "Bearer " + token)
            .attach("file", buffer, "trips.xlsx");
        const r = await upload();
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const payload = {
          header: { ...input(), status: "Draft" },
          mapping: r.body.data.mapping,
        };
        const preview = await post(
          "/imports/" + r.body.data.batchId + "/preview",
          payload,
        );
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.data.successfulRows, 1);
        assert.equal(preview.body.data.failedRows, 1);
        const confirmed = await post(
          "/imports/" + r.body.data.batchId + "/confirm",
          { ...payload, confirm: true, expectedTotal: 4750 },
        );
        assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
        assert.equal((await upload()).status, 409);
        assert.equal(
          (
            await post("/imports/" + r.body.data.batchId + "/confirm", {
              ...payload,
              confirm: true,
              expectedTotal: 4750,
            })
          ).status,
          409,
        );
      },
    );
  },
);
