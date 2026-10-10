import dotenv from "dotenv";
import mongoose from "mongoose";
import {CityRate,TripRate,Audit,User,Vehicle} from "../models/index.js";
import {masterSchemas} from "../validators/index.js";
import {sequence} from "../services/sequenceService.js";
dotenv.config({path:"server/.env",quiet:true});
const city=[["8 FT","Closed Body Vehicle",1242,645],["9 FT","Closed Body Vehicle",1491,1032],["14 FT","Container truck",1987,1290],["17 FT","Container truck",2657,1320],["20 FT","Container truck",3812,1800]].map(([vehicleType,makeModel,tripRate,nightDetention])=>masterSchemas.cityRates.parse({vehicleType,makeModel,tripRate,overtimeRate:200,nightDetention}));
const km=[["8 FT","Closed Body Vehicle",2200,3300,18],["9 FT","Closed Body Vehicle",2750,3850,25],["14 FT","Container truck",3190,4180,27],["17 FT","Container truck",3300,4400,32],["19 FT","Container truck",3560,4800,34],["20 FT","Container truck",3850,5390,36],["Above 20 FT","ODC",9900,14300,48]].map(([vehicleType,makeModel,upTo50,upTo150,above150])=>masterSchemas.tripRates.parse({vehicleType,makeModel,upTo50,upTo150,above150,overtimeRate:200,pnqOvertimeRate:200}));
try{
 await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:15000});
 const admin=await User.findOne({role:"ADMIN",active:true}).select("_id").lean();if(!admin)throw new Error("No administrator");
 console.log(JSON.stringify({database:mongoose.connection.name,vehicleCount:await Vehicle.countDocuments({archived:false}),apply:process.argv.includes("--apply"),cityRates:city,kmRates:km}));
 if(process.argv.includes("--apply")){
  const session=await mongoose.startSession();
  try{await session.withTransaction(async()=>{
   for(const [Model,scope,prefix,rows] of [[CityRate,"cityRates","CITY-",city],[TripRate,"tripRates","TRATE-",km]])for(const data of rows){
    const existing=await Model.findOne({vehicleType:data.vehicleType,active:true,archived:false}).session(session),previous=existing?.toObject();
    let saved;if(existing){Object.assign(existing,data,{updatedBy:admin._id});saved=await existing.save({session});}else{const rateId=await sequence(scope,prefix,session);[saved]=await Model.create([{...data,rateId,createdBy:admin._id,updatedBy:admin._id}],{session});}
    await Audit.create([{entity:Model.modelName,entityId:saved._id,previousValue:previous,newValue:saved.toObject(),reason:"Adhoc rate chart supplied by user",changedBy:admin._id}],{session});
   }
  });}finally{await session.endSession();}
  for(const [Model,rows] of [[CityRate,city],[TripRate,km]])for(const expected of rows){const actual=await Model.findOne({vehicleType:expected.vehicleType,active:true,archived:false}).lean();if(Object.entries(expected).some(([k,v])=>actual[k]!==v))throw new Error("Verification failed");}
  console.log("Verified: 5 city trip rates and 7 kilometre rates saved.");
 }
}catch(error){console.error("Rate chart load failed:",error.name,error.code||"");process.exitCode=1;}finally{await mongoose.disconnect();}
