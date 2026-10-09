import test from "node:test";
import assert from "node:assert/strict";
import {brandedAdc,logAdcAmounts} from "../../shared/brandedLogs.js";
const row=(id,date,time="07:00")=>({_id:id,date,openingTime:time,totalHours:8});
test("weekly-off shift gets ADC before monthly allowance is exhausted",()=>{
 const logs=[row("off","2026-10-09"),row("a","2026-10-10"),row("b","2026-10-10","15:00")],offs=[{date:"2026-10-09"}];
 const amounts=logAdcAmounts(logs,16,1914,1,undefined,offs);assert.equal(amounts.get("off"),1914);assert.equal(amounts.get("a"),0);assert.equal(amounts.get("b"),0);
 assert.equal(brandedAdc(logs,480,offs).additionalServices,1);
});
test("weekly-off duty is not counted again as monthly excess",()=>{
 const logs=[row("regular","2026-10-08"),row("off","2026-10-09")];const adc=brandedAdc(logs,8,["2026-10-09"]);
 assert.equal(adc.offDutyMinutes,480);assert.equal(adc.regularExtraMinutes,0);assert.equal(adc.additionalServices,1);
});
test("other monthly excess and held weekly-off shifts both count",()=>{
 const logs=[row("a","2026-10-08"),row("b","2026-10-08","15:00"),{...row("held","2026-10-09"),held:true,distanceKm:0}];
 const adc=brandedAdc(logs,8,["2026-10-09"]);assert.equal(adc.regularExtraMinutes,480);assert.equal(adc.additionalServices,2);
});
