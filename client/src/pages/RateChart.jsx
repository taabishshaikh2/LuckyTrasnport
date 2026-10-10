import React,{useState} from "react";
import Masters from "./Masters";
import AdhocCharges from "../features/AdhocCharges";
export default function RateChart({user}) {
 const [tab,setTab]=useState("fleetRates");
 return <><h1>Rate chart</h1><div className="actions">{[["fleetRates","Fixed monthly rates"],["cityRates","Trip based / city limits"],["tripRates","Kilometre based services"],["charges","Adhoc monthly charges"]].map(([k,label])=><button key={k} className={tab===k?"":"quiet"} onClick={()=>setTab(k)}>{label}</button>)}</div>{tab==="charges"?<AdhocCharges/>:<Masters key={tab} entity={tab} user={user}/>}</>;
}
