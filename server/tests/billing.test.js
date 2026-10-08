import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { fleetLines,totalLines } from "../services/fleetBillingService.js";
import { calculateInvoice } from "../services/invoiceCalculationService.js";
import { calculateTrip } from "../services/tripCalculationService.js";
import { parseWorkbook,validateRows } from "../services/excelImportService.js";
import { siteWorkbook } from "../services/excelExportService.js";
import { sites,siteColumns } from "../../shared/sites.js";
test("G092 fixed example reproduces deployment and invoice totals",()=>{
  const lines=[1,2,3].flatMap(n=>fleetLines("Fixed",{vehicleId:"v"+n,fixedKm:5000,fixedRate:25.76},{},"MH"+n));
  assert.equal(totalLines(lines).taxable,386400);
  assert.equal(calculateInvoice(386400,{stateCode:"27",cgstRate:9,sgstRate:9,igstRate:0,roundToRupee:true},"27").totalAmount,455952);
});
test("G089 variable calculation preserves per-vehicle rounding and airport treatment",()=>{
  const km=[990,751,931,745,782],shifts=[6,10,5,8,2.130616509926855],tokens=[11,11,12,6,11];
  const lines=km.flatMap((distanceKm,n)=>fleetLines("Variable",{vehicleId:"v"+n,mileage:7,fuelType:"Diesel",fuelRate:97.83,
    serviceRate:1914,amcRate:2.5,parkingMonthly:3000,airportEntryRate:250,airportTaxable:false},
    {distanceKm,additionalServices:shifts[n],airportEntries:tokens[n]},"MH"+n));
  assert.deepEqual(totalLines(lines),{taxable:143767,nonTaxable:12750});
  assert.equal(calculateInvoice(143767,{nonTaxableAmount:12750,stateCode:"27",cgstRate:9,sgstRate:9,igstRate:0,roundToRupee:true},"27").totalAmount,182395);
});
test("G101 overtime uses exact minutes, including totals above 24 hours",()=>{
  const ot=287+57/60;
  const result=calculateTrip({totalHours:8+ot},{billingMethod:"Fixed + Overtime",baseHours:8,baseRate:2657,overtimeRate:200});
  assert.equal(result.overtimeAmount,57590);
});
test("all four site templates retain the exact 16 columns",()=>{
  for (const site of sites) {
    const b=XLSX.read(siteWorkbook([],site.value),{type:"buffer"});
    const headings=XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]],{header:1})[0];
    assert.deepEqual(headings,siteColumns.map(c=>c[0]));
  }
});
test("site export roundtrip retains AWB, consignee, challan and multi-day closing date",()=>{
  const trip={tripId:"TR-one",site:"VVR",vehicleNumber:"MH02AA0001",vehicleType:"17 FT",periodFrom:"2026-06-18",periodTo:"2026-06-20",
    totalHours:48,baseDutyHours:8,overtimeHours:40,baseAmount:2657,subtotal:10657,extraAmount:50,totalAmount:10707,
    entries:[{date:"2026-06-18",awbNumber:"000123",customerName:"WAYLANE",challanNumber:"0001",openingTime:"12:00",closingTime:"12:00",closingDate:"2026-06-20"}]};
  const p=parseWorkbook(siteWorkbook([trip],"VVR"));const row=validateRows(p.rows,p.mapping,{durationFormat:"hoursMinutes"})[0];
  assert.equal(row.data.awbNumber,"000123");assert.equal(row.data.customerName,"WAYLANE");assert.equal(row.data.challanNumber,"0001");
  assert.equal(row.data.closingDate,"2026-06-20");assert.equal(row.data.sdcCharges,10657);assert.equal(row.data.totalHours,48);
});
test("repeated monthly headers with shifted columns and merged dates are recognized",()=>{
  const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([["Summary"]]),"Summary");
  const s=XLSX.utils.aoa_to_sheet([["Date","Vehicle No","Opening Time","Closing Time"],["2026-06-01","MH1","12:00","20:00"],
    ["","MH2","12:00","20:00"],["TOTAL",0],["July"],["Sr No","Date","Vehicle No","Opening Time","Closing Time"],
    [1,"2026-07-01","MH3","12:00","20:00"]]);s["!merges"]=[{s:{r:1,c:0},e:{r:2,c:0}}];XLSX.utils.book_append_sheet(b,s,"Movements");
  const p=parseWorkbook(XLSX.write(b,{type:"buffer",bookType:"xlsx"}));
  assert.equal(p.selectedSheet,"Movements");assert.equal(p.rows.length,3);
  assert.equal(p.rows[1].Date,"2026-06-01");assert.equal(p.rows[2].Date,"2026-07-01");assert.equal(p.rows[2]["Vehicle No"],"MH3");
});

test("monthly extra duty uses exact minutes for all assigned shifts", async()=>{
  const {dutyAllowance}=await import("../services/simpleFleetBillingService.js");
  for (const shift of [8,16,24]) {
    const value=dutyAllowance(26*shift+48.5,shift,"2026-06-01","2026-06-30");
    assert.equal(value.includedMinutes,26*shift*60);assert.equal(value.extraMinutes,2910);
    assert.equal(value.additionalServices,6.0625);
  }
  assert.equal(dutyAllowance(200,8,"2026-06-01","2026-06-30").extraMinutes,0);
  const partial=dutyAllowance(104.5,8,"2026-06-01","2026-06-15");
  assert.equal(partial.includedDays,13);assert.equal(partial.extraMinutes,30);assert.equal(partial.additionalServices,.0625);
});
