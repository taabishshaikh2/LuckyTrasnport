import { Router } from "express";
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
    }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
      throw new AppError("Invalid username or password", 401);
    ok(res, {
      token: jwt.sign({}, process.env.JWT_SECRET, {
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
router.get("/me", auth, (req, res) => ok(res, req.user));
export default router;
