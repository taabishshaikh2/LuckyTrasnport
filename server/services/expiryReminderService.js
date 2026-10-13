import crypto from "node:crypto";
import { z } from "zod";
import {
  Vehicle,
  ReminderSettings,
  ReminderDelivery,
} from "../models/index.js";
import { expiryAlerts, indiaDay } from "../../shared/vehicleExpiry.js";
export const reminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    recipients: z
      .array(z.string().trim().toLowerCase().email().max(254))
      .max(10),
  })
  .strict()
  .transform((v) => ({ ...v, recipients: [...new Set(v.recipients)] }))
  .refine(
    (v) => !v.enabled || v.recipients.length > 0,
    "Enter at least one reminder email address",
  );
export const emailConfigured = () =>
  !!process.env.RESEND_API_KEY && !!process.env.REMINDER_EMAIL_FROM;
export async function getReminderSettings() {
  const record = await ReminderSettings.findById("expiry").lean();
  return {
    enabled: !!record?.enabled,
    recipients: record?.recipients || [],
    emailConfigured: emailConfigured(),
  };
}
export async function getExpiryAlerts(now = new Date()) {
  return expiryAlerts(
    await Vehicle.find({ archived: false })
      .select(
        "vehicleNumber insuranceValid insuranceExpiry pucValid pucExpiry archived",
      )
      .lean(),
    now,
  );
}
export async function sendReminderEmail({ to, subject, text, key }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: process.env.REMINDER_EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Email provider rejected the request");
  const result = await response.json();
  if (!result.id) throw new Error("Email delivery could not be confirmed");
  return result.id;
}
export async function runExpiryReminders({
  now = new Date(),
  send = sendReminderEmail,
  configured = emailConfigured(),
} = {}) {
  const settings = await getReminderSettings();
  if (!settings.enabled || !configured)
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: !settings.enabled ? "disabled" : "email-not-configured",
    };
  const day = indiaDay(now),
    alerts = (await getExpiryAlerts(now)).filter((a) => a.emailDue);
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const alert of alerts)
    for (const recipient of settings.recipients) {
      const key = crypto
        .createHash("sha256")
        .update(
          [alert.vehicleId, alert.kind, alert.expiryDate, recipient, day].join(
            "|",
          ),
        )
        .digest("hex");
      try {
        await ReminderDelivery.updateOne(
          { _id: key },
          {
            $setOnInsert: {
              day,
              vehicleId: alert.vehicleId,
              kind: alert.kind,
              expiryDate: alert.expiryDate,
              recipient,
              state: "Pending",
              attempts: 0,
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
      const claim = await ReminderDelivery.findOneAndUpdate(
        {
          _id: key,
          state: { $ne: "Sent" },
          $and: [
            {
              $or: [
                { lockUntil: { $exists: false } },
                { lockUntil: { $lte: now } },
              ],
            },
            {
              $or: [
                { retryAt: { $exists: false } },
                { retryAt: { $lte: now } },
              ],
            },
          ],
        },
        {
          $set: { lockUntil: new Date(+now + 5 * 60000) },
          $inc: { attempts: 1 },
        },
        { new: true },
      ).lean();
      if (!claim) {
        result.skipped++;
        continue;
      }
      try {
        // Recheck current document and recipients immediately before contacting the provider.
        const current = await Vehicle.findById(alert.vehicleId).lean(),
          fresh = await getReminderSettings();
        if (
          !fresh.enabled ||
          !fresh.recipients.includes(recipient) ||
          !expiryAlerts(current ? [current] : [], now).some(
            (a) =>
              a.kind === alert.kind &&
              a.expiryDate === alert.expiryDate &&
              a.emailDue,
          )
        ) {
          await ReminderDelivery.deleteOne({
            _id: key,
            state: { $ne: "Sent" },
          });
          result.skipped++;
          continue;
        }
        const providerId = await send({
          to: recipient,
          key,
          subject: `${alert.vehicleNumber}: ${alert.label} expires in ${alert.daysRemaining} day${alert.daysRemaining === 1 ? "" : "s"}`,
          text: `Vehicle: ${alert.vehicleNumber}\nDocument: ${alert.label}\nExpiry date: ${alert.expiryDate}\nDays remaining: ${alert.daysRemaining}\n\nPlease renew and update the expiry date in Lucky Transport. Updating it stops reminders for the old date.`,
        });
        await ReminderDelivery.updateOne(
          { _id: key },
          {
            $set: { state: "Sent", providerId, sentAt: now },
            $unset: { lockUntil: 1, retryAt: 1, lastError: 1 },
          },
        );
        result.sent++;
      } catch {
        await ReminderDelivery.updateOne(
          { _id: key },
          {
            $set: {
              state: "Pending",
              lastError: "Email could not be sent; automatic retry scheduled",
              retryAt: new Date(+now + 30 * 60000),
            },
            $unset: { lockUntil: 1 },
          },
        );
        result.failed++;
      }
    }
  return result;
}
export function startReminderScheduler() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runExpiryReminders();
    } catch {
      console.error("Expiry reminder check failed; will retry");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 15 * 60000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
