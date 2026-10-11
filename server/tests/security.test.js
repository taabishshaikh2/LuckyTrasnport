import test from "node:test";
import assert from "node:assert/strict";
import {errorHandler,AppError} from "../utils/errors.js";
import {safeInput} from "../middleware/security.js";
test("sensitive library errors are never returned to clients",()=>{
 for(const err of [Object.assign(new Error("secret connection string"),{status:400}),Object.assign(new Error("raw body secret"),{status:400,type:"entity.parse.failed"})]){
  let body;const res={status(){return this;},json(v){body=v;}};const log=console.error;console.error=()=>{};try{errorHandler(err,{},res,()=>{});}finally{console.error=log;}assert.ok(!JSON.stringify(body).includes("secret"));assert.deepEqual(body.errors,[]);
 }
});
test("query operators and prototype paths are rejected, normal fields pass",()=>{
 for(const body of [{$where:"evil"},{name:{$ne:null}},{"constructor":"evil"},{"profile.role":"ADMIN"}]){let error;safeInput({body,query:{}},{},e=>error=e);assert.ok(error instanceof AppError);}
 let error;safeInput({body:{name:"Depot",entries:[{date:"2026-07-01"}]},query:{site:"Inbound"}},{},e=>error=e);assert.equal(error,undefined);
});
