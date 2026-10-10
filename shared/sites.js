export const sites = [

  { value: "Inbound", label: "Inbound - Cargo to MIDC", origin: "Cargo", destination: "MIDC" },
  { value: "Outbound", label: "Outbound — Marwah to Cargo", origin: "Marwah", destination: "Cargo" },
  { value: "Goregaon", label: "GGT1 (Goregaon) to Cargo", origin: "Goregaon", destination: "Cargo" },
  {value:"Byculla",label:"Byculla to Cargo",origin:"Byculla",destination:"Cargo"},
  {value:"PNQ",label:"PNQ",origin:"Pune",destination:"Cargo"},
  { value: "VVR", label: "Vidhyavihar (VVR) to Cargo", origin: "Vidhyavihar", destination: "Cargo" },
];
export const siteColumns = [
  ["SR.NO", "srNo"], ["DATE", "date"], ["VEHICLE - NO", "vehicleNo"],
  ["VEHICLE TYPE", "vehicleType"], ["AWB NO", "awbNumber"], ["ORIGIN", "pickupLocation"],
  ["DESTINATION", "dropLocation"], ["CUSTOMER", "customerName"], ["OPENING TIME", "openingTime"],
  ["CLOSING TIME", "closingTime"], ["PER TRIP HRS", "perTripHours"], ["TOTAL HRS", "totalHours"],
  ["OT IN HRS", "gtInHours"], ["SDC CHARGES", "sdcCharges"],
  ["CASH & FAST TAG TOLL", "tollParking"], ["TOTAL AMOUNT", "totalServiceCharges"],
];
export const durationText = (hours) => {
  const minutes = Math.round(Number(hours || 0) * 60);
  return Math.floor(minutes / 60) + ":" + String(minutes % 60).padStart(2, "0");
};
