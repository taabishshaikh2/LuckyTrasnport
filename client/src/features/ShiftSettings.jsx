import React,{useState,useEffect} from "react";
import {useData} from "../hooks/useData";
import {api,message} from "../api/client";
export default function ShiftSettings({user}) {
 const data=useData("/settings/shifts"),[entries,setEntries]=useState([]),[error,setError]=useState(""),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{if(data.data)setEntries(data.data.entries);},[data.data]);
 const edit=user.role==="ADMIN";
 const change=(i,key,value)=>{setEntries(rows=>rows.map((r,n)=>n===i?{...r,[key]:value}:r));setSaved(false);};
 async function save(e){e.preventDefault();setBusy(true);setError("");try{await api.put("/settings/shifts",{entries});setSaved(true);data.reload();}catch(e){setError(message(e));}finally{setBusy(false);}}
 return <section className="card"><h2>Monthly shift allowances</h2><p>Save shifts once. You can change the hours or monthly KM, or add a new shift.</p>{data.error && <p className="error">{message(data.error)}</p>}{error && <p className="error">{error}</p>}{saved && <p role="status">Shifts saved</p>}
 <form onSubmit={save}><div className="shift-entries">{entries.map((r,i)=><div className="shift-entry" key={i}><label className="field"><span>Shift hours</span><input aria-label={"Shift hours "+(i+1)} type="number" min="0.01" step="any" required disabled={!edit} value={r.hours} onChange={e=>change(i,"hours",e.target.value)}/></label><label className="field"><span>Monthly KM</span><input aria-label={"Monthly KM "+(i+1)} type="number" min="0.01" step="any" required disabled={!edit} value={r.monthlyKm} onChange={e=>change(i,"monthlyKm",e.target.value)}/></label>{edit && <button type="button" className="quiet" aria-label={"Remove shift "+(i+1)} onClick={()=>{setEntries(rows=>rows.filter((_,n)=>n!==i));setSaved(false);}}>Remove</button>}</div>)}</div> {edit && <div className="actions"><button type="button" className="quiet" onClick={()=>setEntries(rows=>[...rows,{hours:"",monthlyKm:""}])}>Add shift</button><button disabled={busy}>Save shifts</button></div>}</form></section>;
}
