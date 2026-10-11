import rateLimit from "express-rate-limit";
import {AppError} from "../utils/errors.js";
export const apiLimit=rateLimit({windowMs:60000,limit:240,standardHeaders:"draft-8",legacyHeaders:false,message:{success:false,message:"Too many requests. Please wait a minute and try again",errors:[]}});
export const recoveryLimit=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-8",legacyHeaders:false,message:{success:false,message:"Too many recovery attempts. Please try again later",errors:[]}});
export const importLimit=rateLimit({windowMs:60000,limit:20,standardHeaders:"draft-8",legacyHeaders:false,message:{success:false,message:"Too many uploads. Please wait a minute",errors:[]}});
function unsafe(value){if(!value||typeof value!=="object")return false;return Object.entries(value).some(([key,item])=>key.startsWith("$")||key.includes(".")||["__proto__","constructor","prototype"].includes(key)||unsafe(item));}
export function safeInput(req,res,next){if(unsafe(req.body)||unsafe(req.query))return next(new AppError("Invalid request fields",400));next();}
