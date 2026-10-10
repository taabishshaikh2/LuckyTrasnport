import React from "react";
import {Link} from "react-router-dom";
import {adhocRows,adhocSummary,cityColumns,kmColumns,isCity,adhocCell} from "../../../shared/adhoc.js";
import {currency} from "../components/UI";
import {durationText} from "../../../shared/sites.js";
export default function AdhocTripTable({trips}){const all=adhocRows(trips);return <>{[...new Set(all.map(r=>r.site))].map(site=>{const rows=all.filter(r=>r.site===site),s=adhocSummary(rows),columns=isCity(site)?cityColumns:kmColumns;return <section key={site}><h2>{site} trips</h2><p>Trip amount: {currency(s.tripAmount)} | OT: {durationText(s.otHours)} / {currency(s.otAmount)} | Monthly parking: {currency(s.parking)}{s.night>0&&" | Night detention: "+currency(s.night)} | Total: {currency(s.total)}</p><div className="sheet-scroll"><table className="trip-sheet"><thead><tr>{columns.map(([label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((r,index)=><tr key={r._id}>{columns.map(([,k])=><td key={k}>{k==="srNo"?<Link to={"/trips/"+r._id}>{index+1}</Link>:adhocCell(r,k)}</td>)}</tr>)}</tbody></table></div></section>})}</>;}
