import React,{useState} from "react";
import {Link} from "react-router-dom";
import {api,message} from "../api/client";
import {Badge} from "../components/UI";
export function TripStatus({trip}){return <Badge>{trip.archived?"Archived":trip.status==="Approved"?"Active · Approved":trip.status}</Badge>;}
export default function TripActions({trip,user,onChanged}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 if(user?.role==="DRIVER"||trip.archived)return <td>—</td>;
 async function activate(){setBusy(true);setError("");try{
  if(trip.status==="Draft")await api.post("/trips/"+trip._id+"/status",{status:"Submitted"});
  await api.post("/trips/"+trip._id+"/status",{status:"Approved"});
 }catch(e){setError(message(e));}finally{setBusy(false);onChanged?.();}}
 return <td><div className="actions">{["Draft","Submitted"].includes(trip.status)&&<button disabled={busy} onClick={activate}>{busy?"Activating…":"Activate trip"}</button>}{trip.status==="Draft"?<Link className="button quiet" to={"/trips/"+trip._id+"?edit=true"}>Edit trip</Link>:<Link className="button quiet" to={"/trips/"+trip._id}>View trip</Link>}</div>{error&&<p className="error" role="alert">{error}</p>}</td>;
}
