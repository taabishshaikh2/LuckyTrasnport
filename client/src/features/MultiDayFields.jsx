import React,{useState,useEffect} from "react";
import {Field,today} from "../components/UI";
export const nextTripDay=date=>new Date(Date.parse(String(date).slice(0,10)+"T00:00:00Z")+86400000).toISOString().slice(0,10);
export default function MultiDayFields({entry,onChange}){
 const start=String(entry.date||today()).slice(0,10),closing=String(entry.closingDate||"").slice(0,10);
 const [multi,setMulti]=useState(closing>start);
 useEffect(()=>{setMulti(closing>start);},[start,closing]);
 return <><Field name="multiDay" label="Multi-day trip" type="checkbox" value={multi} onChange={(_,checked)=>{setMulti(checked);onChange("closingDate",checked?nextTripDay(start):"");}}/>{multi&&<label className="field"><span>Closing date</span><input type="date" required min={nextTripDay(start)} value={closing} onChange={e=>onChange("closingDate",e.target.value)}/></label>}</>;
}
