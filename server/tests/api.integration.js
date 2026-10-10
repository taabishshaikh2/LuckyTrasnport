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
      "empty trip exports return a message while templates remain available",
      async () => {
        const empty = await get("/exports/trips.xlsx");
        assert.equal(empty.status, 404);
        assert.match(empty.body.message, /No trips match/);
        assert.equal(empty.headers["content-disposition"], undefined);
        assert.equal((await get("/exports/import-template.xlsx")).status, 200);
      },
    );
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
      const empty = await get("/exports/trips.xlsx?from=2099-01-01");
      assert.equal(empty.status, 404);
      assert.equal(empty.headers["content-disposition"], undefined);
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
      "bulk mixed vehicles, independent charges, review token and overlapping files",
      async () => {
        const vehicle = (
          await post("/masters/vehicles", {
            vehicleNumber: "MH02AB5678",
            vehicleType: "17 FT",
          })
        ).body.data;
        const rows = [
          {
            Date: "2026-10-06",
            "Vehicle No": "MH02AB1234",
            "Challan Number": "BULK1",
            "Opening Time": "12:00",
            "Closing Time": "20:30",
            "Total Hrs": "8.30",
            "Toll And Parking": 50,
          },
          {
            Date: "2026-10-06",
            "Vehicle No": vehicle.vehicleNumber,
            "Challan Number": "BULK2",
            "Opening Time": "12:00",
            "Closing Time": "01:00",
            "Total Hrs": "13.00",
          },
        ];
        const uploadRows = async (list) => {
          const b = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(
            b,
            XLSX.utils.json_to_sheet(list),
            "Trips",
          );
          return request(app)
            .post("/api/imports/upload")
            .set("Authorization", "Bearer " + token)
            .attach(
              "file",
              XLSX.write(b, { type: "buffer", bookType: "xlsx" }),
              "bulk.xlsx",
            );
        };
        const uploaded = await uploadRows([...rows, rows[0]]);
        assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
        const payload = {
          header: {
            customerId: refs.customers._id,
            routeId: refs.routes._id,
            periodFrom: "2026-10-01",
            periodTo: "2026-10-31",
          },
          mapping: uploaded.body.data.mapping,
          durationFormat: "hoursMinutes",
        };
        const url = "/imports/" + uploaded.body.data.batchId;
        const p = await post(url + "/preview", payload);
        assert.equal(p.status, 200, JSON.stringify(p.body));
        assert.equal(p.body.data.successfulRows, 2);
        assert.equal(p.body.data.duplicateRows, 1);
        assert.equal(p.body.data.calculation.totalAmount, 8300);
        assert.equal(
          (
            await post(url + "/confirm", {
              ...payload,
              confirm: true,
              reviewToken: "stale",
            })
          ).status,
          409,
        );
        const saved = await post(url + "/confirm", {
          ...payload,
          confirm: true,
          reviewToken: p.body.data.reviewToken,
        });
        assert.equal(saved.status, 201, JSON.stringify(saved.body));
        assert.equal(saved.body.data.trips.length, 2);
        const records = await Trip.find({
          _id: { $in: saved.body.data.trips.map((t) => t._id) },
        });
        assert.ok(
          records.every(
            (t) =>
              t.status === "Draft" && t.entries.length === 1 && !t.driverId,
          ),
        );
        assert.equal(records[1].totalHours, 13);
        const repeat = await uploadRows(rows);
        const preview = await post(
          "/imports/" + repeat.body.data.batchId + "/preview",
          { ...payload, mapping: repeat.body.data.mapping },
        );
        assert.equal(preview.body.data.successfulRows, 0);
        assert.equal(preview.body.data.duplicateRows, 2);
        assert.equal(
          (
            await post("/trips/" + records[0]._id + "/status", {
              status: "Submitted",
            })
          ).status,
          400,
        );
      },
    );
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
          {
            ...payload,
            confirm: true,
            reviewToken: preview.body.data.reviewToken,
          },
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
    await t.test("fleet fixed and variable invoices coexist; claims, stale review and cancellation are enforced",async()=>{
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02FC9001",vehicleType:"17 FT"})).body.data;
      const agreementInput={name:"Gateway test agreement",vehicleId:vehicle._id,customerId:refs.customers._id,site:"Inbound",
        effectiveFrom:"2026-01-01",shiftHours:24,fixedKm:5000,fixedRate:25.76,mileage:7,fuelType:"Diesel",fuelRate:100,
        serviceRate:1914,amcRate:2,parkingMonthly:50,airportEntryRate:250,airportTaxable:false,overtimeRate:200};
      assert.equal((await post("/masters/agreements",agreementInput,manager)).status,403);
      const agreement=await post("/masters/agreements",agreementInput);
      assert.equal(agreement.status,201,JSON.stringify(agreement.body));
      assert.equal((await post("/masters/agreements",agreementInput)).status,400);
      const base={customerId:refs.customers._id,site:"Inbound",billingType:"Fixed",vehicleIds:[vehicle._id],
        periodFrom:"2026-10-01",periodTo:"2026-10-31",invoiceDate:"2026-10-07",dueDate:"2026-11-07",
        stateCode:"27",placeOfSupply:"Maharashtra",cgstRate:9,sgstRate:9,taxConfirmed:true};
      const p=await post("/invoices/preview",base);assert.equal(p.status,200,JSON.stringify(p.body));
      assert.equal(p.body.data.baseAmount,128800);
      const raced=await Promise.all([1,2].map(()=>post("/invoices",{...base,expectedTotal:p.body.data.totalAmount,reviewToken:p.body.data.reviewToken})));
      assert.deepEqual(raced.map(r=>r.status).sort(),[201,409]);
      const issued=raced.find(r=>r.status===201);
      assert.equal(issued.status,201,JSON.stringify(issued.body));
      assert.equal((await post("/invoices/preview",base)).status,409);
      const variable={...base,billingType:"Variable",periodFrom:"2026-10-16",metrics:[{vehicleId:vehicle._id,
        distanceKm:70,additionalServices:2,overtimeHours:0.5,airportEntries:4,parkingFraction:0.5,reason:"Reviewed period records and half monthly parking"}]};
      const vp=await post("/invoices/preview",variable);assert.equal(vp.status,200,JSON.stringify(vp.body));
      assert.equal(vp.body.data.baseAmount,5093);assert.equal(vp.body.data.nonTaxableAmount,1000);
      const vi=await post("/invoices",{...variable,expectedTotal:vp.body.data.totalAmount,reviewToken:vp.body.data.reviewToken});
      assert.equal(vi.status,201,JSON.stringify(vi.body));
      const excel=await get("/exports/trips.xlsx?invoiceId="+vi.body.data._id).buffer(true).parse((res,done)=>{
        const chunks=[];res.on("data",b=>chunks.push(b));res.on("end",()=>done(null,Buffer.concat(chunks)));res.on("error",done);
      });assert.equal(excel.status,200);
      const file=XLSX.read(excel.body,{type:"buffer"});assert.ok(file.SheetNames.includes("Narration"));
      assert.equal((await get("/exports/invoices/"+vi.body.data._id+".pdf")).status,200);
      assert.equal((await get("/exports/invoices/"+vi.body.data._id+".docx")).status,200);
      assert.equal((await post("/invoices/"+issued.body.data._id+"/cancel",{reason:"Test cancellation"})).status,200);
      const fresh=await post("/invoices/preview",base);assert.equal(fresh.status,200);
      await request(app).patch("/api/masters/agreements/"+agreement.body.data._id).set("Authorization","Bearer "+token).send({...agreementInput,fixedRate:25.75});
      assert.equal((await post("/invoices",{...base,expectedTotal:fresh.body.data.totalAmount,reviewToken:fresh.body.data.reviewToken})).status,409);
    });

    await t.test("simple rate/fuel/expense pages automatically calculate variable and fixed invoices",async()=>{
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02FG2797",vehicleType:"TATA 407 LPT"})).body.data;
      const common={customerId:refs.customers._id,site:"Goregaon"};
      const rateInput={...common,name:"407 eight-hour rate",vehicleType:vehicle.vehicleType,shiftHours:8,fixedRate:20,serviceRate:1914,amcRate:0,effectiveFrom:"2026-01-01"};
      assert.equal((await post("/masters/fleetRates",rateInput,manager)).status,403);
      const rate=await post("/masters/fleetRates",rateInput);assert.equal(rate.status,201,JSON.stringify(rate.body));
      assert.equal((await post("/masters/fleetRates",rateInput)).status,400);
      const assignment=await post("/masters/agreements",{...common,name:"407 shift",vehicleId:vehicle._id,fleetRateId:rate.body.data._id,shiftHours:8,effectiveFrom:"2026-01-01"});
      assert.equal(assignment.status,201,JSON.stringify(assignment.body));assert.equal(assignment.body.data.fixedKm,3000);
      const fuelInput={...common,name:"June diesel",vehicleId:vehicle._id,periodFrom:"2026-06-01",periodTo:"2026-06-30",mileage:7,fuelRate:98,fuelType:"Diesel"};
      const fuel=await post("/masters/fuelCharges",fuelInput,manager);assert.equal(fuel.status,201,JSON.stringify(fuel.body));
      assert.equal((await post("/masters/fuelCharges",fuelInput)).status,400);
      await Trip.create({...common,tripId:"SIMPLE-QA-001",vehicleId:vehicle._id,vehicleNumber:vehicle.vehicleNumber,vehicleType:vehicle.vehicleType,
        dutyKind:"Branded",status:"Completed",operationalCompleted:true,periodFrom:"2026-06-01",periodTo:"2026-06-30",distanceKm:700,totalHours:256.5,
        entries:[{date:"2026-06-01",sdcCharges:1000,tollParking:999,totalHours:256.5}]});
      const expense={...common,vehicleId:vehicle._id,name:"June parking",date:"2026-06-30",category:"Parking",quantity:1,rate:3000};
      assert.equal((await post("/masters/vehicleExpenses",expense,manager)).status,201);
      assert.equal((await post("/masters/vehicleExpenses",{...expense,name:"July excluded",date:"2026-07-01",rate:9000})).status,201);
      assert.equal((await post("/masters/airportExpenses",{...common,vehicleId:vehicle._id,name:"June tokens",date:"2026-06-30",quantity:4,rate:250},manager)).status,201);
      const input={...common,billingType:"Variable",vehicleIds:[vehicle._id],periodFrom:"2026-06-01",periodTo:"2026-06-30",invoiceDate:"2026-07-01",dueDate:"2026-08-01",stateCode:"27",placeOfSupply:"Maharashtra",cgstRate:9,sgstRate:9,taxConfirmed:true,roundToRupee:false};
      const p=await post("/invoices/preview",input);assert.equal(p.status,200,JSON.stringify(p.body));
      assert.equal(p.body.data.narration.vehicles[0].metrics.additionalServices,6.0625);
      // 1000 trip + 9800 fuel + 11603.625 extra service + 3000 parking. Source toll is not charged again.
      assert.equal(p.body.data.baseAmount,25403.63);assert.equal(p.body.data.nonTaxableAmount,1000);
      assert.equal(p.body.data.cgstAmount,2286.33);assert.equal(p.body.data.totalAmount,30976.29);
      await request(app).patch("/api/masters/fuelCharges/"+fuel.body.data._id).set("Authorization","Bearer "+token).send({...fuelInput,fuelRate:99});
      assert.equal((await post("/invoices",{...input,expectedTotal:p.body.data.totalAmount,reviewToken:p.body.data.reviewToken})).status,409);
      const fresh=await post("/invoices/preview",input);const issued=await post("/invoices",{...input,expectedTotal:fresh.body.data.totalAmount,reviewToken:fresh.body.data.reviewToken});
      assert.equal(issued.status,201,JSON.stringify(issued.body));assert.equal((await post("/invoices/preview",input)).status,409);
      const fixed=await post("/invoices/preview",{...input,billingType:"Fixed"});assert.equal(fixed.status,200,JSON.stringify(fixed.body));
      assert.equal(fixed.body.data.baseAmount,60000);assert.equal(fixed.body.data.totalAmount,70800);assert.equal(fixed.body.data.nonTaxableAmount,0);
      assert.equal((await get("/exports/invoices/"+issued.body.data._id+".pdf")).status,200);
      assert.equal((await get("/exports/invoices/"+issued.body.data._id+".docx")).status,200);
    });
    await t.test("one challan across daily rows imports as one trip, with one base fare",async()=>{
      const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([
        {Date:"2026-10-10","Vehicle No":"MH02AB1234","Challan Number":"CONT-001","Opening Time":"12:00","Closing Time":"20:00","AWB NO":"0008",CUSTOMER:"WAYLANE"},
        {Date:"2026-10-11","Vehicle No":"MH02AB1234","Challan Number":"CONT-001","Opening Time":"12:00","Closing Time":"20:00","AWB NO":"0008",CUSTOMER:"WAYLANE"},
      ]),"Trips");
      const upload=await request(app).post("/api/imports/upload").set("Authorization","Bearer "+token)
        .attach("file",XLSX.write(book,{type:"buffer",bookType:"xlsx"}),"continuation.xlsx");
      const payload={header:{customerId:refs.customers._id,routeId:refs.routes._id,site:"Outbound",periodFrom:"2026-10-01",periodTo:"2026-10-31"},mapping:upload.body.data.mapping};
      const url="/imports/"+upload.body.data.batchId;
      const p=await post(url+"/preview",payload);assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.data.successfulRows,1);
      assert.equal(p.body.data.rows[1].status,"Continuation");
      const result=await post(url+"/confirm",{...payload,confirm:true,reviewToken:p.body.data.reviewToken});
      assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.data.trips.length,1);
      const record=await Trip.findById(result.body.data.trips[0]._id);assert.equal(record.entries.length,2);
      assert.equal(record.totalHours,16);assert.equal(record.baseAmount,4000);assert.equal(record.overtimeAmount,1000);
      assert.equal(record.entries[0].awbNumber,"0008");
    });
    await t.test("one saved chart prices manual and imported trips, with both monthly invoice types",async()=>{
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02QA4070",vehicleType:"Custom",customVehicleType:"QA 407"})).body.data;
      const common={customerId:refs.customers._id,site:"VVR"};
      const tripInput={...common,routeId:refs.routes._id,vehicleId:vehicle._id,dutyKind:"Branded",periodFrom:"2026-08-01",periodTo:"2026-08-01",distanceKm:40,totalHours:8.5,
        entries:[{date:"2026-08-01",openingTime:"03:00",closingTime:"11:30",perTripHours:8,challanNumber:"QA-SAVED-RATE"}]};
      assert.equal((await post("/trips/preview",tripInput)).status,400);
      const chart={vehicleType:"QA 407",upTo50:2200,upTo150:3300,above150:18,overtimeRate:200};
      assert.equal((await post("/masters/tripRates",chart,manager)).status,403);
      const saved=await post("/masters/tripRates",chart);assert.equal(saved.status,201,JSON.stringify(saved.body));
      assert.equal((await post("/masters/tripRates",chart)).status,409);
      const preview=await post("/trips/preview",tripInput);assert.equal(preview.status,200,JSON.stringify(preview.body));
      assert.equal(preview.body.data.calculation.totalAmount,2300);
      const made=await post("/trips",{...tripInput,expectedTotal:2300});assert.equal(made.status,201,JSON.stringify(made.body));
      assert.equal(made.body.data.rateSnapshot.source,"TripRate");
      await Trip.updateOne({_id:made.body.data._id},{$set:{status:"Completed",operationalCompleted:true}});
      const monthly=(await post("/masters/fleetRates",{...common,name:"QA monthly",vehicleType:"Custom",shiftHours:8,fixedRate:20,serviceRate:1914,effectiveFrom:"2026-01-01"})).body.data;
      assert.ok(monthly?._id);
      assert.equal((await post("/masters/agreements",{...common,name:"QA shift",vehicleId:vehicle._id,fleetRateId:monthly._id,shiftHours:8,effectiveFrom:"2026-01-01"})).status,201);
      await post("/masters/fuelCharges",{...common,name:"QA fuel",vehicleId:vehicle._id,periodFrom:"2026-08-01",periodTo:"2026-08-31",mileage:10,fuelRate:100,fuelType:"Diesel"});
      await post("/masters/airportExpenses",{...common,name:"QA entry",vehicleId:vehicle._id,date:"2026-08-01",quantity:1,rate:250});
      const billing={...common,billingType:"Variable",vehicleIds:[vehicle._id],periodFrom:"2026-08-01",periodTo:"2026-08-31",invoiceDate:"2026-09-01",dueDate:"2026-10-01",placeOfSupply:"Maharashtra",stateCode:"27",cgstRate:9,sgstRate:9,taxConfirmed:true,roundToRupee:false};
      const variable=await post("/invoices/preview",billing);assert.equal(variable.status,200,JSON.stringify(variable.body));
      assert.equal(variable.body.data.baseAmount,2700);assert.equal(variable.body.data.nonTaxableAmount,250);assert.equal(variable.body.data.totalAmount,3436);
      const issued=await post("/invoices",{...billing,expectedTotal:variable.body.data.totalAmount,reviewToken:variable.body.data.reviewToken});assert.equal(issued.status,201,JSON.stringify(issued.body));
      const fixed=await post("/invoices/preview",{...billing,billingType:"Fixed"});assert.equal(fixed.status,200,JSON.stringify(fixed.body));assert.equal(fixed.body.data.totalAmount,70800);
      const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Date:"2026-08-02","Vehicle No":vehicle.vehicleNumber,KM:151,"Total Hours":8.5,"Per Trip Hrs":8,"Challan Number":"QA-IMPORT-RATE"}]),"Trips");
      const upload=await request(app).post("/api/imports/upload").set("Authorization","Bearer "+token).attach("file",XLSX.write(book,{type:"buffer",bookType:"xlsx"}),"qa-rate.xlsx");
      const payload={header:{...tripInput,periodTo:"2026-08-31"},mapping:upload.body.data.mapping,durationFormat:"decimal"};
      const url="/imports/"+upload.body.data.batchId;
      const imported=await post(url+"/preview",payload);assert.equal(imported.status,200,JSON.stringify(imported.body));assert.equal(imported.body.data.successfulRows,1,JSON.stringify(imported.body));
      assert.equal(imported.body.data.rows[0].calculation.totalAmount,2818);
    });
    await t.test("weekly offs save and edit all vehicle dates together",async()=>{
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02OFFGROUP",vehicleType:"8 FT",branded:true,shiftHours:8})).body.data;
      const input={customerId:refs.customers._id,vehicleId:vehicle._id,month:"2026-09",dates:["2026-09-06","2026-09-13","2026-09-20","2026-09-27"],expectedRows:[]};
      const put=v=>request(app).put("/api/masters/weeklyOffs/month").set("Authorization","Bearer "+token).send(v);
      assert.equal((await put(input)).status,200);
      const rows=(await get("/masters/weeklyOffs?month=2026-09")).body.data.filter(r=>r.vehicleId===vehicle._id);assert.equal(rows.length,4);
      assert.equal((await put(input)).status,409);
      const edit={...input,expectedRows:rows.map(r=>({_id:r._id,updatedAt:r.updatedAt})),dates:["2026-09-06","2026-09-13","2026-09-20","2026-09-28"]};
      assert.equal((await put({...edit,dates:["2026-09-06","2026-09-06"]})).status,400);
      assert.equal((await put({...edit,dates:["2026-10-01"]})).status,400);
      assert.equal((await put(edit)).status,200);
      const saved=(await get("/masters/weeklyOffs?month=2026-09")).body.data.filter(r=>r.vehicleId===vehicle._id);assert.deepEqual(saved.map(r=>r.date.slice(0,10)).sort(),edit.dates);
    });
    await t.test("branded Excel preview, atomic confirmation and repeat upload protection",async()=>{
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02IMPORT8",vehicleType:"8 FT",branded:true,shiftHours:8})).body.data;
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Date","Vehicle no.","Opening KM","Closing KM","Total KM","Opening time","Closing time","Total hours","Additional service charges","Domestic airport entry"],["2026-09-01",vehicle.vehicleNumber,100,110,999,"07:00","15:00",999,999,250],["",vehicle.vehicleNumber,"Load held at warehouse","Load held at warehouse",999,"15:00","23:00",999,999,0]]),"Logs");const buffer=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});
      const upload=confirm=>request(app).post("/api/imports/branded-logs").set("Authorization","Bearer "+token).field("customerId",refs.customers._id).field("confirm",String(confirm)).attach("file",buffer,"logs.xlsx");
      const preview=await upload(false);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.data.errors.length,0);assert.deepEqual(preview.body.data.rows.map(r=>r.distanceKm),[10,0]);assert.equal(preview.body.data.rows[0].totalHours,8);
      const confirmed=await upload(true);assert.equal(confirmed.status,201,JSON.stringify(confirmed.body));assert.equal(confirmed.body.data.count,2);
      const duplicate=await upload(false);assert.equal(duplicate.body.data.errors.length,2);assert.equal((await upload(true)).status,400);
      assert.equal((await get("/exports/branded-log-template.xlsx")).status,200);
    });
    await t.test("branded shift logs calculate variable charges without sites or agreements",async()=>{
      const common={customerId:refs.customers._id};
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02BRAND16",vehicleType:"TATA 407",branded:true,shiftHours:16,adcRate:1914,amcRate:2.5,parkingMonthly:3000,tollEntryMonthly:1000})).body.data;
      assert.ok(vehicle._id);
      const fuel=await post("/masters/fuelCharges",{...common,site:"Branded",name:"June fuel",vehicleId:vehicle._id,periodFrom:"2026-06-01",periodTo:"2026-06-30",mileage:7,fuelRate:97.83,fuelType:"Diesel"});assert.equal(fuel.status,201);
      const shift={...common,vehicleId:vehicle._id,date:"2026-06-01",openingKm:1000,closingKm:1990,openingTime:"07:00",closingTime:"15:00",airportFee:250};
      const first=await post("/masters/brandedLogs",shift);assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(first.body.data.distanceKm,990);assert.equal(first.body.data.totalHours,8);
      assert.equal((await post("/masters/brandedLogs",shift)).status,409);
      assert.equal((await post("/masters/brandedLogs",{...shift,openingTime:"08:00",closingTime:"15:00"})).status,400);
      for(let n=1;n<58;n++){
        const day=Math.floor(n/2)+1,second=n%2===1;
        const row=await post("/masters/brandedLogs",{...shift,date:"2026-06-"+String(day).padStart(2,"0"),openingTime:second?"15:00":"07:00",closingTime:second?"23:00":"15:00",held:true,holdLocation:"Loading warehouse",airportFee:0});assert.equal(row.status,201,JSON.stringify(row.body));assert.equal(row.body.data.distanceKm,0);
      }
      const exported=await get("/exports/branded-logs.xlsx?month=2026-06&vehicleId="+vehicle._id).buffer(true).parse((res,done)=>{const chunks=[];res.on("data",b=>chunks.push(b));res.on("end",()=>done(null,Buffer.concat(chunks)));res.on("error",done);});assert.equal(exported.status,200);
      const wb=XLSX.read(exported.body,{type:"buffer"});const sheet=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});assert.equal(sheet[10].length,10);assert.equal(sheet[0][0],"Vendor name");assert.equal(sheet[4][9],11484);assert.equal(sheet.find(row=>row[0]==="TOTAL")[8],11484);
      for(const day of [7,14,21,28])assert.equal((await post("/masters/weeklyOffs",{...common,vehicleId:vehicle._id,date:"2026-06-"+String(day).padStart(2,"0")})).status,201);
      const input={...common,site:"Branded",billingType:"Variable",vehicleIds:[vehicle._id],periodFrom:"2026-06-01",periodTo:"2026-06-30",invoiceDate:"2026-07-01",dueDate:"2026-08-01",stateCode:"27",placeOfSupply:"Maharashtra",cgstRate:9,sgstRate:9,taxConfirmed:true,roundToRupee:false};
      const preview=await post("/invoices/preview",input);assert.equal(preview.status,200,JSON.stringify(preview.body));
      const data=preview.body.data,metrics=data.narration.vehicles[0].metrics;
      assert.equal(metrics.actualHours,464);assert.equal(metrics.includedHours,416);assert.equal(metrics.additionalServices,8);
      assert.equal(data.lineItems.find(l=>l.description.startsWith("Additional services")).amount,15312);
      assert.equal(data.lineItems.find(l=>l.description.startsWith("AMC")).amount,2475);assert.equal(data.nonTaxableAmount,250);
      assert.equal(data.lineItems.find(l=>l.description==="Monthly toll, entry & parking").amount,4000);
      assert.ok(!data.lineItems.some(l=>l.description==="Trip charges"));
      const issued=await post("/invoices",{...input,expectedTotal:data.totalAmount,reviewToken:data.reviewToken});assert.equal(issued.status,201,JSON.stringify(issued.body));
      const pdf=await get(`/exports/invoices/${issued.body.data._id}.pdf?section=narration`);assert.equal(pdf.status,200);
      assert.equal((await get("/exports/trips.xlsx?invoiceId="+issued.body.data._id)).status,200);
      assert.equal((await request(app).delete("/api/masters/brandedLogs/"+first.body.data._id).set("Authorization","Bearer "+token)).status,409);
    });
    await t.test("saved vehicle shift and selected manager salaries bill without agreements",async()=>{
      const common={customerId:refs.customers._id,site:"Inbound"};
      const vehicle=(await post("/masters/vehicles",{vehicleNumber:"MH02FIX8000",vehicleType:"FIX QA",branded:true,shiftHours:8})).body.data;
      const rate=await post("/masters/fleetRates",{...common,name:"Fixed QA",vehicleType:"FIX QA",shiftHours:8,fixedRate:20,effectiveFrom:"2026-01-01"});assert.equal(rate.status,201);
      const manager=await post("/masters/fleetManagers",{...common,name:"QA manager",monthlySalary:26000});assert.equal(manager.status,201,JSON.stringify(manager.body));
      const input={...common,billingType:"Fixed",vehicleIds:[vehicle._id],managerIds:[manager.body.data._id],periodFrom:"2026-06-01",periodTo:"2026-06-08",invoiceDate:"2026-07-01",dueDate:"2026-08-01",stateCode:"27",placeOfSupply:"Maharashtra",cgstRate:9,sgstRate:9,taxConfirmed:true,roundToRupee:false};
      const preview=await post("/invoices/preview",input);assert.equal(preview.status,200,JSON.stringify(preview.body));
      assert.equal(preview.body.data.baseAmount,86000);assert.equal(preview.body.data.totalAmount,101480);
      assert.equal(preview.body.data.narration.vehicles[0].agreement.fixedKm,3000);
      assert.deepEqual(preview.body.data.lineItems.map(l=>l.quantity),[3000,1]);
      const issued=await post("/invoices",{...input,expectedTotal:preview.body.data.totalAmount,reviewToken:preview.body.data.reviewToken});assert.equal(issued.status,201,JSON.stringify(issued.body));
      for (const section of ["invoice","narration","all"]) { const pdf=await get(`/exports/invoices/${issued.body.data._id}.pdf?section=${section}`);assert.equal(pdf.status,200);assert.match(pdf.headers["content-type"],/application\/pdf/); }
      assert.equal((await post("/invoices/preview",input)).status,409);
      const shifts=await get("/settings/shifts");assert.deepEqual(shifts.body.data.entries.map(s=>s.hours),[8,16,24]);
      const edited=await request(app).put("/api/settings/shifts").set("Authorization","Bearer "+token).send({entries:[...shifts.body.data.entries,{hours:12,monthlyKm:3500}]});assert.equal(edited.status,200,JSON.stringify(edited.body));
    });
    await t.test("Adhoc city and kilometre rates, trip entry and monthly Excel summaries",async()=>{
      const v=(await post("/masters/vehicles",{vehicleNumber:"MH01ADHOCQA",vehicleType:"ADHOC QA",parkingMonthly:7500})).body.data;
      assert.ok(v._id);
      assert.equal((await post("/masters/cityRates",{vehicleType:"ADHOC QA",makeModel:"Closed body",tripRate:1242,overtimeRate:200,nightDetention:645},manager)).status,403);
      assert.equal((await post("/masters/cityRates",{vehicleType:"ADHOC QA",makeModel:"Closed body",tripRate:1242,overtimeRate:200,nightDetention:645})).status,201);
      assert.equal((await post("/masters/tripRates",{vehicleType:"ADHOC QA",upTo50:2200,upTo150:3300,above150:18,overtimeRate:200,pnqOvertimeRate:250})).status,201);
      const input={customerId:refs.customers._id,vehicleId:v._id,site:"Inbound",adhocService:"City",periodFrom:"2026-06-01",periodTo:"2026-06-01",pickupLocation:"Cargo",dropLocation:"MIDC",entries:[{date:"2026-06-01",openingTime:"20:00",closingTime:"05:30",mrbArrivalTime:"23:00",chaName:"QA CHA"}]};
      const review=await post("/trips/preview",input);assert.equal(review.status,200,JSON.stringify(review.body));assert.equal(review.body.data.calculation.totalAmount,1542);
      const night=await post("/trips/preview",{...input,nightDetention:true});assert.equal(night.body.data.calculation.totalAmount,2187);
      const created=await post("/trips",{...input,status:"Submitted",expectedTotal:1542});assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(created.body.data.parkingSnapshot,7500);assert.equal(created.body.data.entries[0].closingDate,"2026-06-02");assert.equal(created.body.data.rateSnapshot.source,"CityRate");
      const two={...input,periodFrom:"2026-06-03",periodTo:"2026-06-03",entries:[{...input.entries[0],date:"2026-06-03"}]};const next=await post("/trips",{...two,status:"Submitted",expectedTotal:1542});assert.equal(next.status,201,JSON.stringify(next.body));
      const km={...input,site:"VVR",adhocService:"Kilometre",distanceBand:"0-50",distanceKm:40};const k=await post("/trips/preview",km);assert.equal(k.status,200,JSON.stringify(k.body));assert.equal(k.body.data.calculation.totalAmount,2500);
      assert.equal((await post("/trips/preview",{...input,site:"VVR"})).status,400);
      assert.equal((await post("/masters/accPasses",{customerId:refs.customers._id,site:"Inbound",month:"2026-06",amount:7500})).status,201);
      const file=await get("/exports/trips.xlsx?site=Inbound&vehicleId="+v._id+"&from=2026-06-01&to=2026-06-30").buffer(true).parse((res,done)=>{const chunks=[];res.on("data",b=>chunks.push(b));res.on("end",()=>done(null,Buffer.concat(chunks)));res.on("error",done);});assert.equal(file.status,200,JSON.stringify(file.body));
      const wb=XLSX.read(file.body,{type:"buffer"}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});assert.equal(rows[0][11],2484);assert.equal(rows[1][9],"3:00");assert.equal(rows[1][11],600);assert.equal(rows[2][11],7500);assert.equal(rows[3][11],10584);assert.equal(rows[4][3],"CHA NAME");assert.equal(rows[4].length,12);assert.ok(rows.some(row=>row.includes("DHL Representatives Sign")&&row.includes("Vendor Sign")));
      for(const id of [created.body.data._id,next.body.data._id])assert.equal((await post("/trips/"+id+"/status",{status:"Approved"})).status,200);
      const invoiceInput={customerId:refs.customers._id,billingType:"Adhoc",site:"Inbound",tripIds:[created.body.data._id,next.body.data._id],periodFrom:"2026-06-01",periodTo:"2026-06-30",invoiceDate:"2026-07-01",dueDate:"2026-08-01",stateCode:"27",placeOfSupply:"Maharashtra",cgstRate:9,sgstRate:9,taxConfirmed:true,roundToRupee:false};
      const bill=await post("/invoices/preview",invoiceInput);assert.equal(bill.status,200,JSON.stringify(bill.body));assert.equal(bill.body.data.baseAmount,10584);assert.equal(bill.body.data.lineItems.find(l=>l.category==="ACC daily & monthly pass").amount,7500);
      const issued=await post("/invoices",{...invoiceInput,expectedTotal:bill.body.data.totalAmount,reviewToken:bill.body.data.reviewToken});assert.equal(issued.status,201,JSON.stringify(issued.body));assert.equal((await get("/exports/invoices/"+issued.body.data._id+".pdf")).status,200);
      const draft=await post("/trips",{...two,status:"Draft",expectedTotal:1542});assert.equal(draft.status,201);assert.equal((await post("/trips/"+draft.body.data._id+"/status",{status:"Submitted"})).status,200);assert.equal((await post("/trips/"+draft.body.data._id+"/status",{status:"Approved"})).status,200);
      const followup=await post("/invoices/preview",{...invoiceInput,tripIds:[draft.body.data._id]});assert.equal(followup.status,200,JSON.stringify(followup.body));assert.equal(followup.body.data.baseAmount,1542);assert.ok(!followup.body.data.lineItems.some(l=>l.category==="ACC daily & monthly pass"));
    });
  },
);

test("trip archive hides records and supports restoration", async () => {
      // Give this independent scenario its own proxy client IP and rate-limit window.
      const get=url=>request(app).get("/api"+url).set("X-Forwarded-For","203.0.113.20").set("Authorization","Bearer "+token);
      const post=(url,data,t=token)=>request(app).post("/api"+url).set("X-Forwarded-For","203.0.113.20").set("Authorization","Bearer "+t).send(data);
      const trip=await Trip.create({tripId:"ARCHIVE-TEST",status:"Draft",periodFrom:new Date(),periodTo:new Date(),vehicleNumber:"TEST",totalAmount:0});
      try {
        assert.equal((await post("/trips/"+trip._id+"/archive",{archived:true},driver)).status,403);
        assert.equal((await post("/trips/"+trip._id+"/archive",{archived:true})).status,200);
        assert.ok(!(await get("/trips")).body.data.some(v=>v._id===String(trip._id)));
        assert.ok((await get("/trips?archived=true")).body.data.some(v=>v._id===String(trip._id)));
        assert.ok(!(await get("/dashboard")).body.data.recentTrips.some(v=>v._id===String(trip._id)));
        assert.equal((await get("/exports/trips.xlsx?tripId="+trip._id)).status,404);
        assert.equal((await post("/trips/"+trip._id+"/status",{status:"Submitted"})).status,404);
        assert.equal((await post("/trips/"+trip._id+"/archive",{archived:false})).status,200);
        assert.ok((await get("/trips")).body.data.some(v=>v._id===String(trip._id)));
        await Trip.updateOne({_id:trip._id},{$set:{status:"Approved"}});
        assert.equal((await post("/trips/"+trip._id+"/archive",{archived:true})).status,409);
      } finally { await Trip.deleteOne({_id:trip._id}); }
    });

test("site pages and Excel include only the chosen site and inclusive date range",async()=>{
 const fixture=[{tripId:"SITE-JUL-IN",site:"Inbound",periodFrom:new Date("2030-07-31"),vehicleNumber:"FILTER-IN"},{tripId:"SITE-JUL-OUT",site:"Outbound",periodFrom:new Date("2030-07-31"),vehicleNumber:"FILTER-OUT"},{tripId:"SITE-AUG-IN",site:"Inbound",periodFrom:new Date("2030-08-01"),vehicleNumber:"FILTER-AUG"}];
 const docs=await Trip.create(fixture.map(t=>({...t,adhocService:"City",status:"Draft",vehicleType:"8 FT",baseAmount:100,totalHours:8,overtimeHours:0,entries:[{date:t.periodFrom,chaName:"CHA",openingTime:"08:00",closingTime:"16:00"}]})));
 const get=url=>request(app).get("/api"+url).set("X-Forwarded-For","203.0.113.21").set("Authorization","Bearer "+token);
 try{
  const q="site=Inbound&from=2030-07-01&to=2030-07-31";
  const list=await get("/trips?"+q);assert.equal(list.status,200);assert.deepEqual(list.body.data.map(t=>t.tripId),["SITE-JUL-IN"]);
  const file=await get("/exports/trips.xlsx?"+q).buffer(true).parse((res,done)=>{const chunks=[];res.on("data",b=>chunks.push(b));res.on("end",()=>done(null,Buffer.concat(chunks)));res.on("error",done);});assert.equal(file.status,200);
  const wb=XLSX.read(file.body,{type:"buffer"});assert.equal(wb.SheetNames.length,1);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});assert.ok(rows.some(row=>row.includes("FILTER-IN")));assert.ok(!rows.some(row=>row.includes("FILTER-OUT")||row.includes("FILTER-AUG")));
 }finally{await Trip.deleteMany({_id:{$in:docs.map(t=>t._id)}});}
});
test("ACC passes save/edit by customer-site-month and protect billed amounts",async()=>{
 const {Customer,AccPass,BillingClaim}=await import("../models/index.js");
 const customer=await Customer.create({companyName:"ACC test customer",archived:false});
 const call=(method,url,data)=>request(app)[method]("/api"+url).set("Authorization","Bearer "+token).set("X-Forwarded-For","203.0.113.44").send(data);
 const input={customerId:String(customer._id),site:"Inbound",month:"2026-07",amount:7500};
 try{
  const created=await call("post","/masters/accPasses",input);assert.equal(created.status,201,JSON.stringify(created.body));
  const pass=await AccPass.findOne({customerId:customer._id}),url="/masters/accPasses/"+pass._id;
  assert.equal((await call("post","/masters/accPasses",input)).status,409);
  assert.equal((await call("patch",url,{...input,amount:8000})).status,200);
  await BillingClaim.create({key:`acc-pass:${customer._id}:Inbound:2026-07`,invoiceId:new mongoose.Types.ObjectId()});
  assert.equal((await call("patch",url,{...input,amount:9000})).status,409);
  assert.equal((await call("delete",url)).status,409);
 }finally{await BillingClaim.deleteMany({key:`acc-pass:${customer._id}:Inbound:2026-07`});await AccPass.deleteMany({customerId:customer._id});await Customer.deleteOne({_id:customer._id});}
});
