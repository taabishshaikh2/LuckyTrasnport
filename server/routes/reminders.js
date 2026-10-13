import { Router } from "express";
import { operations, admin } from "../middleware/auth.js";
import { ReminderSettings, ReminderDelivery, Audit } from "../models/index.js";
import { wrap, ok, AppError } from "../utils/errors.js";
import {
  getExpiryAlerts,
  getReminderSettings,
  reminderSettingsSchema,
  emailConfigured,
} from "../services/expiryReminderService.js";
const router = Router();
router.get(
  "/alerts",
  operations,
  wrap(async (req, res) => ok(res, await getExpiryAlerts())),
);
router.get(
  "/settings",
  admin,
  wrap(async (req, res) => {
    const settings = await getReminderSettings(),
      day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    const deliveries = await ReminderDelivery.find({ day })
      .select("vehicleId kind expiryDate recipient state sentAt lastError")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    ok(res, { ...settings, deliveries });
  }),
);
router.put(
  "/settings",
  admin,
  wrap(async (req, res) => {
    const input = reminderSettingsSchema.parse(req.body);
    if (input.enabled && !emailConfigured())
      throw new AppError(
        "Configure the Resend API key and reminder sender email on the server before enabling email reminders",
      );
    await ReminderSettings.findOneAndUpdate(
      { _id: "expiry" },
      { $set: { ...input, updatedBy: req.user._id } },
      { upsert: true },
    );
    await Audit.create({
      entity: "ReminderSettings",
      reason: "Expiry reminder settings updated",
      changedBy: req.user._id,
    });
    ok(res, await getReminderSettings());
  }),
);
export default router;
