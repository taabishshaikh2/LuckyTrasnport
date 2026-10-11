import { Router } from "express";
import crypto from "node:crypto";
import {recoveryLimit} from "../middleware/security.js";
import {admin} from "../middleware/auth.js";
import {id} from "../validators/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { wrap, ok, AppError } from "../utils/errors.js";
import { z } from "zod";
const router = Router();
router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many sign-in attempts. Try later",
      errors: [],
    },
  }),
  wrap(async (req, res) => {
    const input = z
      .object({
        username: z.string().min(1).max(60),
        password: z.string().min(1).max(100),
      })
      .parse(req.body);
    const user = await User.findOne({
      username: input.username,
      active: true,
    }).select("+passwordHash +sessionVersion");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
      throw new AppError("Invalid username or password", 401);
    ok(res, {
      token: jwt.sign({version:Number(user.sessionVersion||0)}, process.env.JWT_SECRET, {
        subject: String(user._id),
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
        algorithm: "HS256",
      }),
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  }),
);
router.post("/forgot-password",recoveryLimit,wrap(async(req,res)=>{
 const {username}=z.object({username:z.string().trim().min(1).max(60)}).parse(req.body);
 await User.updateOne({username,active:true},{$set:{recoveryRequestedAt:new Date()}});
 ok(res,{message:"If this account exists, a recovery request has been recorded. Contact your administrator to verify your identity and receive a reset link."});
}));
router.get("/recovery-requests",auth,admin,wrap(async(req,res)=>{
 const users=await User.find({active:true,recoveryRequestedAt:{$ne:null}}).select("name username +recoveryRequestedAt").lean();
 ok(res,users.map(u=>({_id:u._id,name:u.name,username:u.username,requestedAt:u.recoveryRequestedAt})));
}));
router.post("/users/:id/reset-link",auth,admin,recoveryLimit,wrap(async(req,res)=>{
 const token=crypto.randomBytes(32).toString("hex"),expiresAt=new Date(Date.now()+30*60000);
 const user=await User.findOneAndUpdate({_id:id.parse(req.params.id),active:true},{$set:{resetTokenHash:crypto.createHash("sha256").update(token).digest("hex"),resetExpiresAt:expiresAt},$unset:{recoveryRequestedAt:1}},{new:true});
 if(!user)throw new AppError("Account unavailable",404);
 ok(res,{token,expiresAt});
}));
router.post("/reset-password",recoveryLimit,wrap(async(req,res)=>{
 const {token,password}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(10).max(100).refine(p=>Buffer.byteLength(p,"utf8")<=72,"Password must be at most 72 UTF-8 bytes")}).parse(req.body);
 const passwordHash=await bcrypt.hash(password,12);
 const user=await User.findOneAndUpdate({active:true,resetTokenHash:crypto.createHash("sha256").update(token).digest("hex"),resetExpiresAt:{$gt:new Date()}},{$set:{passwordHash},$unset:{resetTokenHash:1,resetExpiresAt:1,recoveryRequestedAt:1},$inc:{sessionVersion:1}},{new:true});
 if(!user)throw new AppError("Reset link is invalid or expired. Request a new link",400);
 ok(res,{message:"Password updated. Sign in with your new password."});
}));
router.get("/me", auth, (req, res) => ok(res, req.user));
export default router;
