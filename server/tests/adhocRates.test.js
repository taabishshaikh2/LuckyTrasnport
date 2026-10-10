import test from "node:test";
import assert from "node:assert/strict";
import {adhocRate} from "../services/adhocRateService.js";
import {calculateTrip} from "../services/tripCalculationService.js";
import {adhocRows,adhocSummary} from "../../shared/adhoc.js";
const chart={upTo50:2200,upTo150:3300,above150:18,overtimeRate:200,pnqOvertimeRate:250};
test("city trip uses saved 8-hour rate, exact minute OT and marked night detention",()=>{
 const rate=adhocRate({adhocService:"City"},{tripRate:1242,overtimeRate:200,nightDetention:645});
 assert.equal(calculateTrip({totalHours:9.5},rate).totalAmount,1542);
 assert.equal(calculateTrip({totalHours:9.5,nightDetention:true},rate).totalAmount,2187);
 assert.equal(calculateTrip({totalHours:8+1/60},rate).overtimeAmount,3.33);
});
test("KM bands and PNQ detention use their own rates and thresholds",()=>{
 for(const [band,km,site,hours,base,ot] of [["0-50",50,"VVR",10,2200,400],["50-150",150,"Byculla",10,3300,400],["Above 150",200,"PNQ",17,3600,250],["Above 150",200,"Goregaon",17,3600,0]]){
 const input={adhocService:"Kilometre",distanceBand:band,distanceKm:km,site,totalHours:hours};const c=calculateTrip(input,adhocRate(input,chart));assert.equal(c.baseAmount,base);assert.equal(c.overtimeAmount,ot);}
 assert.throws(()=>adhocRate({adhocService:"City"},null),/matching/);
 assert.throws(()=>adhocRate({adhocService:"Kilometre",distanceBand:"Above 150",distanceKm:150},chart),/above 150/);
});
test("parking is allocated once per vehicle-month across sites, and summary reconciles",()=>{
 const trip=(day,site="Inbound")=>({_id:day,periodFrom:day,site,vehicleNumber:"MH01",parkingSnapshot:7500,baseAmount:1242,totalHours:10,overtimeHours:2,overtimeAmount:400,entries:[]});
 const rows=adhocRows([trip("2026-06-03","Outbound"),trip("2026-06-01"),trip("2026-07-01")]);assert.deepEqual(rows.map(r=>r.tollParking),[7500,0,7500]);assert.equal(adhocSummary(rows).total,19926);
});

test("exports append signature labels while import templates stay clean",async()=>{
 const {tripWorkbook,importTemplate,brandedWorkbook}=await import("../services/excelExportService.js"),XLSX=(await import("xlsx")).default;
 const legacy=await tripWorkbook([{entries:[],periodFrom:"2026-06-01",vehicleNumber:"MH01"}]);
 const branded=brandedWorkbook([{_id:"one",vehicleId:"v",customerId:"c",date:"2026-06-01",openingTime:"07:00",closingTime:"15:00",totalHours:8,distanceKm:10}],[{_id:"v",vehicleNumber:"MH01",shiftHours:8}]);
 for(const buffer of [legacy,branded]){const wb=XLSX.read(buffer,{type:"buffer"}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});assert.ok(rows.some(r=>r.includes("DHL Representatives Sign")&&r.includes("Vendor Sign")));}
 const template=XLSX.read(importTemplate(),{type:"buffer"});assert.ok(!JSON.stringify(template.Sheets).includes("DHL Representatives Sign"));
});
