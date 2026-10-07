import XLSX from "xlsx";
export const columns = [
  ["Sr No", "srNo"],
  ["Date", "date"],
  ["Challan Number", "challanNumber"],
  ["Vehicle No", "vehicleNo"],
  ["CHA Name", "chaName"],
  ["Vehicle Type", "vehicleType"],
  ["HU No", "huNumber"],
  ["Origin", "pickupLocation"],
  ["Destination", "dropLocation"],
  ["Opening Time", "openingTime"],
  ["MRB Arrival Time", "mrbArrivalTime"],
  ["Closing Time", "closingTime"],
  ["Closing Date", "closingDate"],
  ["Per Trip Hrs", "perTripHours"],
  ["Total Hrs", "totalHours"],
  ["O.T. In Hrs", "gtInHours"],
  ["O.T. In KM", "overtimeKm"],
  ["Trip Charges", "tripCharges"],
  ["OT Amount", "gtAmount"],
  ["Toll And Parking", "tollParking"],
  ["Total SVC Charges", "totalServiceCharges"],
  ["KM", "distanceKm"],
  ["Billing Group", "billingGroup"],
  ["Remarks", "remarks"],
];
const duration = (v) => {
  const m = Math.round(Number(v || 0) * 60);
  return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
};
function bookBuffer(rows, name) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map(() => ({ wch: 22 }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, rows.length - 1), c: rows[0].length - 1 },
    }),
  };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, name);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}
export function importTemplate() {
  return bookBuffer([columns.map((x) => x[0])], "Trips");
}
export async function tripWorkbook(trips) {
  const rows = [
    [
      ...columns.map((x) => x[0]),
      "Trip ID",
      "Customer",
      "Status",
      "Calculated Base Amount",
      "Calculated OT Amount",
      "Calculated Total",
    ],
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
    entries.forEach((e, i) => {
      const v = {
        ...e,
        vehicleNo: e.vehicleNo || t.vehicleNumber,
        vehicleType: e.vehicleType || t.vehicleType,
        pickupLocation: e.pickupLocation || t.pickupLocation,
        dropLocation: e.dropLocation || t.dropLocation,
      };
      rows.push([
        ...columns.map(([_, key]) =>
          key === "date"
            ? new Date(v.date).toISOString().slice(0, 10)
            : ["perTripHours", "totalHours", "gtInHours"].includes(key)
              ? duration(v[key])
              : (v[key] ?? ""),
        ),
        t.tripId,
        t.customerId?.companyName || "",
        t.status,
        i === 0 ? t.baseAmount : "",
        i === 0 ? t.overtimeAmount : "",
        i === 0 ? t.totalAmount : "",
      ]);
    });
  }
  return bookBuffer(rows, "Trips");
}
