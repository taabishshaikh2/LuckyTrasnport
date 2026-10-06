import { Counter } from "../models/index.js";
export function financialYear(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(value));
  const year = Number(parts.find((p) => p.type === "year").value),
    month = Number(parts.find((p) => p.type === "month").value);
  const start = month >= 4 ? year : year - 1;
  return start + "-" + String(start + 1).slice(-2);
}
export async function sequence(scope, prefix, session) {
  const c = await Counter.findOneAndUpdate(
    { _id: scope },
    { $inc: { value: 1 } },
    { upsert: true, new: true, session },
  );
  return prefix + String(c.value).padStart(3, "0");
}
export const invoiceNumber = (date, session) => {
  const fy = financialYear(date);
  return sequence("invoice:" + fy, "INV/" + fy + "/", session);
};
