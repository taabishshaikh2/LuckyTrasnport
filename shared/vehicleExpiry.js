export function indiaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function expiryAlerts(vehicles, now = new Date()) {
  const today = indiaDay(now),
    day = Date.parse(today);
  const alerts = [];
  for (const vehicle of vehicles) {
    if (vehicle.archived) continue;
    for (const [kind, label] of [
      ["insurance", "Insurance"],
      ["puc", "PUC"],
    ]) {
      const expiry = String(vehicle[kind + "Expiry"] || "").slice(0, 10);
      if (
        !vehicle[kind + "Valid"] ||
        !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
        isNaN(Date.parse(expiry))
      )
        continue;
      const days = Math.round((Date.parse(expiry) - day) / 86400000);
      if (days > 7) continue;
      alerts.push({
        vehicleId: String(vehicle._id),
        vehicleNumber: vehicle.vehicleNumber,
        kind,
        label,
        expiryDate: expiry,
        daysRemaining: days,
        emailDue: days >= 1 && days <= 7,
      });
    }
  }
  return alerts.sort(
    (a, b) =>
      a.daysRemaining - b.daysRemaining ||
      a.vehicleNumber.localeCompare(b.vehicleNumber),
  );
}
