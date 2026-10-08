import test from "node:test";
import assert from "node:assert/strict";
import {distanceRate,vehicleRateType,tripChargeTotal} from "../services/distanceRateService.js";
import {calculateTrip} from "../services/tripCalculationService.js";
const chart={upTo50:2200,upTo150:3300,above150:18,overtimeRate:200};
test("distance boundaries fetch the correct saved rate and add overtime by minutes",()=>{
  for(const [km,base] of [[0,2200],[50,2200],[50.01,3300],[150,3300],[151,2718]]) {
    const calc=calculateTrip({distanceKm:km,totalHours:8.5},distanceRate(chart,km,8));
    assert.equal(calc.baseAmount,base);assert.equal(calc.overtimeAmount,100);assert.equal(calc.totalAmount,base+100);
  }
  const calc=calculateTrip({distanceKm:151,totalHours:16+1/60},distanceRate(chart,151,16));
  assert.equal(calc.overtimeAmount,3.33);assert.equal(calc.totalAmount,2721.33);
});
test("saved custom types match separately and variable uses calculated trip total once",()=>{
  assert.equal(vehicleRateType({vehicleType:"Custom",customVehicleType:"TATA 407 LPT"}),"TATA 407 LPT");
  assert.equal(tripChargeTotal([{rateSnapshot:{source:"TripRate"},totalAmount:2300,entries:[{sdcCharges:99999,gtAmount:100}]}]),2300);
  assert.equal(tripChargeTotal([{entries:[{sdcCharges:1000}]}]),1000);
});
