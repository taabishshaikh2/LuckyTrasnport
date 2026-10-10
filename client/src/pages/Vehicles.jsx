import React,{useState} from "react";
import Masters from "./Masters";
export default function Vehicles({user}){const [kind,setKind]=useState("Adhoc");return <><div className="actions">{["Adhoc","Branded"].map(k=><button key={k} className={kind===k?"":"quiet"} onClick={()=>setKind(k)}>{k} vehicles</button>)}</div><Masters key={kind} entity="vehicles" user={user} vehicleKind={kind}/></>;}
