import React from "react";
import { Field } from "../components/UI";
export const sheetFields = [
  ["srNo", "Sr No", "number"],
  ["challanNumber", "Challan number", "text"],
  ["huNumber", "HU number", "text"],
  ["chaName", "CHA name", "text"],
  ["billingGroup", "Billing group", "text"],
  ["vehicleType", "Sheet vehicle type", "text"],
  ["pickupLocation", "Origin / pickup", "text"],
  ["dropLocation", "Destination / drop", "text"],
  ["openingTime", "Opening / pickup arrival time", "time"],
  ["mrbArrivalTime", "MRB / MIDC arrival time", "time"],
  ["closingTime", "Closing time", "time"],
  ["closingDate", "Closing date", "date"],
  ["perTripHours", "Source included hours (decimal)", "number"],
  ["totalHours", "Source total hours (decimal)", "number"],
  ["gtInHours", "Source overtime hours (decimal)", "number"],
  ["overtimeKm", "O.T. IN KM (source)", "number"],
  ["tripCharges", "Source trip charges", "number"],
  ["gtAmount", "Source overtime amount", "number"],
  ["tollParking", "Source toll / parking", "number"],
  ["totalServiceCharges", "Source total service charges", "number"],
  ["distanceKm", "Distance KM", "number"],
  ["remarks", "Remarks", "text"],
];
export function SheetFields({ entry = {}, onChange }) {
  return sheetFields.map(([name, label, type]) => (
    <Field
      key={name}
      name={name}
      label={label}
      type={type}
      value={entry[name]}
      onChange={onChange}
    />
  ));
}
export function SheetSummary({ entry = {} }) {
  return (
    <dl>
      {sheetFields.map(([name, label]) => (
        <React.Fragment key={name}>
          <dt>{label}</dt>
          <dd>{entry[name] ?? "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
