import React,{useState} from "react";
import Masters from "./Masters";
export default function RateChart({user}) {
  const [tab,setTab]=useState("tripRates");
  return <><h1>Rate chart</h1><div className="actions"><button className={tab==="tripRates" ? "" : "quiet"} onClick={()=>setTab("tripRates")}>Trip rates</button><button className={tab==="fleetRates" ? "" : "quiet"} onClick={()=>setTab("fleetRates")}>Monthly rates</button></div><Masters key={tab} entity={tab} user={user}/></>;
}
