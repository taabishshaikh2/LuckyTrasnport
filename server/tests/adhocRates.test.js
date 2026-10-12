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
 const trip=(day,site="VVR")=>({_id:day,periodFrom:day,site,vehicleNumber:"MH01",parkingSnapshot:7500,baseAmount:1242,totalHours:10,overtimeHours:2,overtimeAmount:400,entries:[]});
 const rows=adhocRows([trip("2026-06-03","CCR"),trip("2026-06-01"),trip("2026-07-01")]);assert.deepEqual(rows.map(r=>r.tollParking),[7500,0,7500]);assert.equal(adhocSummary(rows).total,19926);
});

test("exports append signature labels while import templates stay clean",async()=>{
 const {tripWorkbook,importTemplate,brandedWorkbook}=await import("../services/excelExportService.js"),XLSX=(await import("xlsx")).default;
 const legacy=await tripWorkbook([{entries:[],periodFrom:"2026-06-01",vehicleNumber:"MH01"}]);
 const branded=brandedWorkbook([{_id:"one",vehicleId:"v",customerId:"c",date:"2026-06-01",openingTime:"07:00",closingTime:"15:00",totalHours:8,shiftHours:8,distanceKm:10}],[{_id:"v",vehicleNumber:"MH01",shiftHours:8}]);
 for(const buffer of [legacy,branded]){const wb=XLSX.read(buffer,{type:"buffer"}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});assert.ok(rows.some(r=>r.includes("DHL Representatives Sign")&&r.includes("Vendor Sign")));}
 const template=XLSX.read(importTemplate(),{type:"buffer"});assert.ok(!JSON.stringify(template.Sheets).includes("DHL Representatives Sign"));
});

test("ACC pass is once per customer, site and month across vehicles; snapshots stay fixed",async()=>{
 const trip=(id,customerId,site,month,vehicleNumber)=>({_id:id,customerId,site,periodFrom:month+"-01",vehicleNumber,parkingSnapshot:999,baseAmount:100});
 const trips=[trip("1","c","Inbound","2026-07","v1"),trip("2","c","Inbound","2026-07","v2"),trip("3","c","Outbound","2026-07","v1"),trip("4","d","Inbound","2026-07","v1"),trip("5","c","Inbound","2026-08","v1")];
 const passes=[{customerId:"c",site:"Inbound",month:"2026-07",amount:7500},{customerId:"c",site:"Outbound",month:"2026-07",amount:200},{customerId:"d",site:"Inbound",month:"2026-07",amount:300},{customerId:"c",site:"Inbound",month:"2026-08",amount:400}];
 const rows=adhocRows(trips,passes);assert.deepEqual(rows.map(r=>r.accPass),[7500,0,200,300,400]);assert.equal(adhocSummary(rows).total,8900);assert.ok(rows.every(r=>r.tollParking===0));
 assert.deepEqual(adhocRows(trips.slice(0,2).map((t,i)=>({...t,accPassSnapshot:i?123:0})),passes).map(r=>r.accPass),[0,123]);
 const {adhocWorkbook}=await import("../services/excelExportService.js"),XLSX=(await import("xlsx")).default;
 const wb=XLSX.read(adhocWorkbook(trips,"Inbound",{}, {passes}),{type:"buffer"}),data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
 assert.ok(data.some(r=>r.includes("ACC Daily & Monthly Pass")&&r.includes(8200)));
});
test("site sample workbooks map the input columns correctly",async()=>{
 const {importTemplate}=await import("../services/excelExportService.js"),{parseWorkbook,validateRows}=await import("../services/excelImportService.js");
 for(const site of ["Inbound","Outbound","VVR"]){const parsed=parseWorkbook(importTemplate(site));assert.equal(parsed.rows.length,1);assert.ok(parsed.mapping.vehicleNo);assert.ok(parsed.mapping.closingDate);assert.ok(site==="Inbound"?parsed.mapping.chaName:site==="Outbound"?parsed.mapping.huNumber:parsed.mapping.awbNumber);assert.equal(validateRows(parsed.rows,parsed.mapping,{durationFormat:"hoursMinutes"})[0].errors.length,0);}
});

test("new saved routes become site options and parking can be excluded",async()=>{
 const {siteOptions}=await import("../../shared/routeSites.js"),{tripSchema}=await import("../validators/index.js");
 const options=siteOptions([{routeName:"New depot",pickupLocation:"Depot",dropLocation:"Cargo",active:true}]);assert.equal(options[0].value,"New depot");assert.equal(options[0].origin,"Depot");assert.equal(siteOptions([{routeName:"Hidden",active:false}]).length,0);
 const trip={_id:"1",customerId:"c",site:"Inbound",periodFrom:"2026-07-01",baseAmount:100,parkingSnapshot:999};
 const pass={customerId:"c",site:"Inbound",month:"2026-07",amount:7500};assert.equal(adhocSummary(adhocRows([trip],[pass],false)).total,100);
 assert.equal(adhocSummary(adhocRows([{...trip,site:"New depot"}],[],false)).parking,0);
});
test("explicit next-day closing date calculates the multi-day example",async()=>{
 const {pickupDuty}=await import("../services/dutyTimeService.js"),{durationText}=await import("../../shared/sites.js");
 const entry={date:"2026-07-18",openingTime:"12:52",closingTime:"15:30"};
 const same=pickupDuty(entry);assert.equal(durationText(same.totalHours),"2:38");
 const duty=pickupDuty({...entry,closingDate:"2026-07-19"});const calculation=calculateTrip({totalHours:duty.totalHours},adhocRate({adhocService:"City"},{tripRate:1987,overtimeRate:200}));
 assert.equal(durationText(duty.totalHours),"26:38");assert.equal(durationText(calculation.overtimeHours),"18:38");assert.equal(calculation.overtimeAmount,3726.67);
});

test("Special layouts match KM bands, route names and saved per-KM rates",async()=>{
 const {adhocColumns,adhocGroups}=await import("../../shared/adhoc.js"),{adhocWorkbook}=await import("../services/excelExportService.js"),XLSX=(await import("xlsx")).default;
 const make=(id,band,origin,destination)=>{const input={adhocService:"Kilometre",site:"Special",distanceBand:band,distanceKm:band==="Above 150"?392:0,totalHours:8,pickupLocation:origin,dropLocation:destination};const rate=adhocRate(input,chart);return {_id:id,tripId:id,...input,...calculateTrip(input,rate),rateSnapshot:rate,customerId:{companyName:"BOSCH"},vehicleNumber:"MH01TEST",vehicleType:"8 FT",periodFrom:"2026-06-02",entries:[{awbNumber:"9936468426",openingTime:"02:10",closingTime:"09:40",tollParking:1559}]};};
 const trips=[make("a","0-50","DG1","PNQ SPL"),make("b","50-150","DG1","PNQ SPL"),make("c","Above 150","ACC","PNQ SPL"),make("d","Above 150","Warehouse","Other depot")],rows=adhocRows(trips,[],false);
 assert.equal(rows[0].tripCharges,2200);assert.equal(rows[1].tripCharges,3300);assert.equal(rows[2].tripCharges,7056);assert.equal(rows[2].ratePerKm,18);assert.equal(rows[2].perTripHours,16);assert.equal(rows[2].customerName,"BOSCH");assert.equal(rows[2].totalServiceCharges,8615);
 const groups=adhocGroups(rows);assert.equal(groups.length,3);assert.equal(groups[0].rows.length,2);
 assert.deepEqual(adhocColumns("Special",groups[0].rows).map(c=>c[0]),["SR.NO","DATE","VEHICLE - NO","VEHICLE TYPE","AWB NO","ORIGIN","DESTINATION","CUSTOMER","OPENING TIME","CLOSING TIME","PER TRIP HRS","TOTAL HRS","O.T IN HRS","SDC CHARGES","CASH & FAST TAG TOLL","TOTAL AMOUNT"]);
 assert.equal(adhocColumns("Special",groups[1].rows)[13][0],"ACC TO PNQ SPL TOTAL KM");assert.equal(adhocColumns("Special",groups[1].rows)[14][0],"RATE PER KM");assert.equal(adhocColumns("Inbound",rows).length,12);assert.ok(!adhocColumns("Outbound",rows).some(c=>c[1]==="ratePerKm"));
 const wb=XLSX.read(adhocWorkbook(trips,"Special",{}, {includeParking:false}),{type:"buffer"});assert.equal(wb.SheetNames.length,3);const sheet=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]],{header:1});const header=sheet.findIndex(r=>r.includes("RATE PER KM"));assert.equal(sheet[header+1][13],392);assert.equal(sheet[header+1][14],18);assert.equal(sheet[header+1][15],7056);assert.equal(sheet[header+1][16],1559);
});
