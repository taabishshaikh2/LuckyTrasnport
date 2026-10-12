import test from "node:test";
import assert from "node:assert/strict";
import {billingShift,logAdcAmounts} from "../../shared/brandedLogs.js";
test("billing uses saved shift regardless of current vehicle shift",()=>{
 const logs=[{_id:"a",date:"2026-07-01",openingTime:"07:00",totalHours:8,shiftHours:8}];
 assert.equal(billingShift(logs,undefined,16),8);
 assert.equal(billingShift(logs,16,8),16);
 assert.deepEqual(logAdcAmounts(logs,8,200),logAdcAmounts(logs,16,200));
});
test("missing or mixed historical shifts require explicit selection",()=>{
 assert.throws(()=>billingShift([{}],undefined,16),/Choose/);
 assert.throws(()=>billingShift([{shiftHours:8},{shiftHours:16}]),/Choose/);
 assert.equal(billingShift([{}],8,16),8);
 assert.equal(billingShift([],undefined,16),16);
 assert.throws(()=>billingShift([],12),/Choose/);
});
