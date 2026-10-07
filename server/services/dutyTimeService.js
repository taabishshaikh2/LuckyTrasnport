import { AppError } from "../utils/errors.js";
export function pickupDuty(entry) {
  if (!entry.openingTime || !entry.closingTime) return null;
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let days = 0,
    inferred = false;
  if (entry.closingDate) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.closingDate) ||
      Number.isNaN(Date.parse(entry.closingDate)) ||
      new Date(entry.closingDate).toISOString().slice(0, 10) !==
        entry.closingDate
    )
      throw new AppError("Invalid closing date");
    days = (Date.parse(entry.closingDate) - Date.parse(entry.date)) / 86400000;
  } else if (minutes(entry.closingTime) < minutes(entry.openingTime)) {
    days = 1;
    inferred = true;
  }
  const totalMinutes =
    days * 1440 + minutes(entry.closingTime) - minutes(entry.openingTime);
  if (totalMinutes < 0)
    throw new AppError("Closing time precedes pickup arrival");
  return {
    totalHours: totalMinutes / 60,
    closingDate: new Date(Date.parse(entry.date) + days * 86400000)
      .toISOString()
      .slice(0, 10),
    inferred,
  };
}
