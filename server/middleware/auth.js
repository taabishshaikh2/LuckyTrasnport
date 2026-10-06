import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { AppError, wrap } from "../utils/errors.js";
export const auth = wrap(async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError("Please sign in", 401);
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new AppError("Session expired. Please sign in again", 401);
  }
  const user = await User.findById(claims.sub);
  if (!user?.active) throw new AppError("Account unavailable", 401);
  req.user = user;
  next();
});
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : next(new AppError("You do not have access to this action", 403));
export const operations = roles("ADMIN", "MANAGER");
export const admin = roles("ADMIN");
