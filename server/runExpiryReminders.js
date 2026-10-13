import "./config/env.js";
import mongoose from "mongoose";
import { ReminderDelivery, ReminderSettings } from "./models/index.js";
import { runExpiryReminders } from "./services/expiryReminderService.js";
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([ReminderDelivery.init(), ReminderSettings.init()]);
  const result = await runExpiryReminders();
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
} catch {
  console.error("Expiry reminder job failed");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
