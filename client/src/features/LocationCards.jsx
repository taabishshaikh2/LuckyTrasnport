import React from "react";
import {Badge} from "../components/UI";
import {locationGroup} from "../../../shared/routeSites.js";

export default function LocationCards({records,search="",filter="",onOpen}){
 const visible=records.filter(route=>JSON.stringify(route).toLowerCase().includes(search.toLowerCase())&&(!filter||String(route.active)===filter));
 return <>{["Intercity","Special"].map(group=><section key={group}>
  <h2>{group}</h2>
  <p>{group==="Intercity"?"Inbound and outbound services within trip limits.":"Goregaon, Vidhyavihar, PNQ and other saved origin and destination routes. These locations use KM service bands."}</p>
  <div className="card-grid">{visible.filter(route=>locationGroup(route)===group).map(route=><button className="record card" key={route._id} onClick={()=>onOpen(route)}>
   <span className="record-id">{route.routeId}</span><h3>{route.routeName}</h3>
   <p>{route.pickupLocation} to {route.dropLocation}</p><Badge>{route.active?"Active":"Inactive"}</Badge>
  </button>)}</div>
  {!visible.some(route=>locationGroup(route)===group)&&<p className="muted">No matching {group.toLowerCase()} locations.</p>}
 </section>)}</>;
}
