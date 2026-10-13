import test from "node:test";
import assert from "node:assert/strict";
import {masterSchemas} from "../validators/index.js";
const vehicle={vehicleNumber:"MH01AB1234",vehicleType:"8 FT"};
test("vehicle document dates are required only when checked and cleared when unchecked",()=>{
 assert.ok(masterSchemas.vehicles.safeParse(vehicle).success);
 for(const [flag,expiry] of [["insuranceValid","insuranceExpiry"],["pucValid","pucExpiry"]]){
  assert.ok(!masterSchemas.vehicles.safeParse({...vehicle,[flag]:true}).success);
  assert.ok(!masterSchemas.vehicles.safeParse({...vehicle,[flag]:true,[expiry]:"2026-02-30"}).success);
  const saved=masterSchemas.vehicles.parse({...vehicle,[flag]:true,[expiry]:"2027-01-15"});assert.equal(saved[expiry],"2027-01-15");
  assert.equal(masterSchemas.vehicles.parse({...vehicle,[flag]:false,[expiry]:"2027-01-15"})[expiry],"");
 }
});
