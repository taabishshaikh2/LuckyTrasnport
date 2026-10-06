import XLSX from "xlsx";
export async function tripWorkbook(trips) {
  const headings = [
    "Trip ID",
    "Date",
    "Customer",
    "Vehicle",
    "CHA name",
    "Vehicle type",
    "Pickup",
    "Drop",
    "Opening",
    "MRB arrival",
    "Closing",
    "Trip hours",
    "Total hours",
    "G.T hours",
    "G.T amount",
    "KM",
    "Trip total (once)",
  ];
  const rows = [
    ["Lucky Transport Services — Operational Trip Sheet"],
    headings,
  ];
  for (const t of trips) {
    const entries = t.entries.length
      ? t.entries
      : [
          {
            date: t.periodFrom,
            totalHours: t.totalHours,
            distanceKm: t.distanceKm,
          },
        ];
    entries.forEach((e, i) =>
      rows.push([
        t.tripId,
        new Date(e.date),
        t.customerId?.companyName || "",
        e.vehicleNo || t.vehicleNumber,
        e.chaName || "",
        e.vehicleType || t.vehicleType,
        e.pickupLocation || t.pickupLocation,
        e.dropLocation || t.dropLocation,
        e.openingTime || "",
        e.mrbArrivalTime || "",
        e.closingTime || "",
        e.perTripHours || 0,
        e.totalHours || 0,
        e.gtInHours || 0,
        e.gtAmount || 0,
        e.distanceKm || 0,
        i === 0 ? t.totalAmount : null,
      ]),
    );
  }
  const lastDataRow = rows.length;
  rows.push([
    "TOTAL",
    ...Array(15).fill(null),
    trips.reduce((sum, t) => sum + t.totalAmount, 0),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }];
  sheet["!cols"] = headings.map((_, i) => ({
    wch: [2, 4, 6, 7].includes(i) ? 28 : i === 16 ? 22 : 17,
  }));
  sheet["!autofilter"] = { ref: "A2:Q" + lastDataRow };
  for (let r = 2; r < lastDataRow; r++) {
    const date = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    if (date) date.z = "dd mmm yyyy";
    for (const c of [14, 16]) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = '"INR "#,##0.00';
    }
  }
  const total = sheet["Q" + rows.length];
  total.z = '"INR "#,##0.00';
  if (lastDataRow >= 3) total.f = "SUM(Q3:Q" + lastDataRow + ")";
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Trip sheet");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}
