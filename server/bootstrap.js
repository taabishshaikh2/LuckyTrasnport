import "./config/env.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./models/index.js";
// One-time production provisioning. Credentials are read from the process environment.
const { MONGODB_URI, BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME } =
  process.env;
if (
  !MONGODB_URI ||
  !BOOTSTRAP_USERNAME ||
  !BOOTSTRAP_PASSWORD ||
  BOOTSTRAP_PASSWORD.length < 12
)
  throw new Error(
    "Set MONGODB_URI, BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD (at least 12 characters)",
  );
await mongoose.connect(MONGODB_URI);
try {
  await User.init();
  if (await User.exists({ role: "ADMIN", active: true }))
    throw new Error(
      "An active administrator already exists. Use user management.",
    );
  await User.create({
    name: BOOTSTRAP_NAME || "Administrator",
    username: BOOTSTRAP_USERNAME,
    passwordHash: await bcrypt.hash(BOOTSTRAP_PASSWORD, 12),
    role: "ADMIN",
    active: true,
  });
  console.log(
    "Administrator provisioned. Clear BOOTSTRAP_PASSWORD from your environment.",
  );
} finally {
  await mongoose.disconnect();
}
