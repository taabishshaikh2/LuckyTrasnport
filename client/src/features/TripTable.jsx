import React from "react";
import TripRow from "./TripRow";
import AdhocTripTable from "./AdhocTripTable";
import { Link } from "react-router-dom";
import { siteColumns, durationText } from "../../../shared/sites.js";
export default function TripTable({trips=[],passes=[]}) {
  if(trips.some(t=>t.adhocService))return <AdhocTripTable trips={trips} passes={passes}/>;
  return <div className="sheet-scroll"><table className="trip-sheet"><thead><tr>{siteColumns.map(([label])=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{trips.map((t,i)=>{const e=t.entries?.[0] || {},last=t.entries?.at(-1) || e;
      const row={...e,srNo:i+1,date:t.periodFrom.slice(0,10),vehicleNo:t.vehicleNumber,vehicleType:t.vehicleType,
        customerName:e.customerName || e.chaName || "",pickupLocation:e.pickupLocation || t.pickupLocation,
        dropLocation:e.dropLocation || t.dropLocation,closingTime:last.closingTime,
        perTripHours:t.baseDutyHours ?? e.perTripHours,totalHours:t.totalHours,gtInHours:t.overtimeHours ?? e.gtInHours,
        sdcCharges:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.sdcCharges : t.subtotal ?? t.totalAmount-t.extraAmount,
        tollParking:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.tollParking : t.extraAmount,totalServiceCharges:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.totalServiceCharges : t.totalAmount};
      return <TripRow key={t._id} id={t._id} label={t.tripId}>{siteColumns.map(([,key])=><td key={key}>{key === "srNo" ? <Link to={"/trips/"+t._id}>{i+1}</Link> :
        ["perTripHours","totalHours","gtInHours"].includes(key) ? durationText(row[key]) : row[key] ?? "—"}</td>)}</TripRow>;
    })}</tbody></table></div>;
}
