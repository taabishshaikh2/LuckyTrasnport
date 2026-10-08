import React, { useState, useEffect } from "react";
import { Field } from "../components/UI";
import { durationText } from "../../../shared/sites.js";
export const sheetFields=[
  ["srNo","SR.NO","number"],["awbNumber","AWB NO","text"],["customerName","CUSTOMER / CHA","text"],
  ["vehicleType","VEHICLE TYPE","text"],["pickupLocation","ORIGIN","text"],["dropLocation","DESTINATION","text"],
  ["openingTime","OPENING TIME (pickup arrival)","time"],["closingTime","CLOSING TIME","time"],
  ["perTripHours","PER TRIP HRS (0 = assigned shift, or 8h if unassigned)","duration"],["totalHours","TOTAL HRS","duration"],["gtInHours","OT IN HRS","duration"],
  ["sdcCharges","SDC CHARGES (source)","number"],["tollParking","CASH & FAST TAG TOLL","number"],
  ["totalServiceCharges","TOTAL AMOUNT (source)","number"],
  ["challanNumber","Challan number (one challan = one trip)","text"],["closingDate","Closing date","date"],["huNumber","HU number","text"],
  ["mrbArrivalTime","MIDC / Marwah arrival time","time"],["billingGroup","Bill label / split reference","text"],
  ["openingKm","Opening KM","number"],["closingKm","Closing KM","number"],["distanceKm","Total KM","number"],["additionalKm","Additional KM","number"],
  ["additionalServices","Additional service shifts","number"],["airportEntries","Airport entries / tokens","number"],["fuelLitres","Additional fuel litres","number"],
  ["tripCharges","Source base charge","number"],["gtAmount","Source overtime amount","number"],["remarks","Remarks","text"],
];
function DurationField({name,label,value,onChange}) {
  const [text,setText]=useState(durationText(value));
  useEffect(()=>setText(durationText(value)),[value]);
  return <label className="field"><span>{label} (HH:mm)</span><input value={text} placeholder="08:30" onChange={e=>{
    setText(e.target.value); e.target.setCustomValidity("");
  }} onBlur={e=>{
    const m=text.trim().match(/^(\d+)[.:]([0-5]\d)$/);
    if(!m){e.target.setCustomValidity("Use HH:mm, for example 08:30");e.target.reportValidity();return;}
    onChange(name,(Number(m[1])*60+Number(m[2]))/60);
  }}/></label>;
}
export function SheetFields({entry={},onChange}) {
  const primary=sheetFields.slice(0,14),supporting=sheetFields.slice(14).filter(([name])=>!["additionalServices","airportEntries","fuelLitres"].includes(name));
  const fields=items=>items.map(([name,label,type])=>["sdcCharges","totalServiceCharges","gtInHours","tripCharges","gtAmount"].includes(name) ?
    <label className="field" key={name}><span>{label.replace(" (source)","")} — calculated on review</span><input readOnly value={name === "gtInHours" ? durationText(entry[name]) : entry[name] ?? ""}/></label> : type === "duration" ?
    <DurationField key={name} name={name} label={label} value={entry[name]} onChange={onChange}/> :
    <Field key={name} name={name} label={label} type={type} value={entry[name]} onChange={onChange}/>);
  return <>{fields(primary)}<details className="card" style={{gridColumn:"1 / -1"}}><summary>Challan, KM & supporting details</summary><div className="form-grid">{fields(supporting)}</div></details></>;
}
export function SheetSummary({entry={}}) {return <dl>{sheetFields.map(([name,label,type])=><React.Fragment key={name}>
  <dt>{label}</dt><dd>{type === "duration" ? durationText(entry[name]) : entry[name] ?? "â€”"}</dd>
</React.Fragment>)}</dl>;}
