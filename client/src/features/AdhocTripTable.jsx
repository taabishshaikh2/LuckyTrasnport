import React from "react";
import TripActions,{TripStatus} from "./TripActions";
import TripScroll from "./TripScroll";
import TripRow from "./TripRow";
import {Link} from "react-router-dom";
import {adhocRows,adhocSummary,cityColumns,kmColumns,adhocColumns,isCity,adhocCell} from "../../../shared/adhoc.js";
import {currency} from "../components/UI";
import {durationText} from "../../../shared/sites.js";
export default function AdhocTripTable({trips,passes=[],user,onChanged}){const all=adhocRows(trips,passes);return <>{[...new Set(all.map(r=>r.site))].map(site=>{const rows=all.filter(r=>r.site===site),s=adhocSummary(rows),columns=adhocColumns(site);return <section key={site}><h2>{site} trips</h2><p>Trip amount: {currency(s.tripAmount)} | OT: {durationText(s.otHours)} / {currency(s.otAmount)} | {isCity(site)?"ACC daily & monthly pass":"Monthly parking"}: {currency(isCity(site)?s.accPass:s.parking)}{s.night>0&&" | Night detention: "+currency(s.night)} | Total: {currency(s.total)}</p><TripScroll><table className="trip-sheet"><thead><tr><th>Status</th>{columns.map(([label])=><th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((r,index)=><TripRow key={r._id} id={r._id} label={r.tripId}><td><TripStatus trip={trips.find(t=>String(t._id)===String(r._id))}/></td>{columns.map(([,k])=><td key={k}>{k==="srNo"?<Link to={"/trips/"+r._id}>{index+1}</Link>:adhocCell(r,k)}</td>)}<TripActions trip={trips.find(t=>String(t._id)===String(r._id))} user={user} onChanged={onChanged}/></TripRow>)}</tbody></table></TripScroll></section>})}</>;}
