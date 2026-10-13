import test from "node:test";
import assert from "node:assert/strict";
import { expiryAlerts, indiaDay } from "../../shared/vehicleExpiry.js";
import { reminderSettingsSchema } from "../services/expiryReminderService.js";
test("expiry window uses India dates and sends only days seven through one", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  assert.equal(indiaDay(now), "2026-10-13");
  const vehicle = {
    _id: "v",
    vehicleNumber: "MH01",
    insuranceValid: true,
    pucValid: true,
  };
  for (const [expiry, days, due] of [
    ["2026-10-21", 8, false],
    ["2026-10-20", 7, true],
    ["2026-10-14", 1, true],
    ["2026-10-13", 0, false],
    ["2026-10-12", -1, false],
  ]) {
    const alerts = expiryAlerts([{ ...vehicle, insuranceExpiry: expiry }], now);
    assert.equal(alerts.length, days > 7 ? 0 : 1);
    if (alerts.length) assert.equal(alerts[0].emailDue, due);
  }
});
test("renewed, unchecked, archived and missing documents do not alert", () => {
  const vehicle = {
    _id: "v",
    vehicleNumber: "MH01",
    insuranceValid: true,
    insuranceExpiry: "2026-10-20",
  };
  const now = new Date("2026-10-13T06:00:00Z");
  assert.equal(
    expiryAlerts([{ ...vehicle, insuranceExpiry: "2027-10-20" }], now).length,
    0,
  );
  assert.equal(expiryAlerts([{ ...vehicle, archived: true }], now).length, 0);
  assert.equal(
    expiryAlerts([{ ...vehicle, insuranceValid: false }], now).length,
    0,
  );
  assert.equal(
    expiryAlerts([{ ...vehicle, insuranceExpiry: "" }], now).length,
    0,
  );
});
test("reminder settings require valid recipients and deduplicate emails", () => {
  assert.ok(
    !reminderSettingsSchema.safeParse({ enabled: true, recipients: [] })
      .success,
  );
  assert.ok(
    !reminderSettingsSchema.safeParse({ enabled: false, recipients: ["bad"] })
      .success,
  );
  assert.deepEqual(
    reminderSettingsSchema.parse({
      enabled: true,
      recipients: ["OPS@example.com", "ops@example.com"],
    }).recipients,
    ["ops@example.com"],
  );
});
