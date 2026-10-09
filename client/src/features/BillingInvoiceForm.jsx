import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { api,message } from "../api/client";
import { Field,today,currency } from "../components/UI";
import { TaxSummary } from "../pages/Invoices";
import { sites } from "../../../shared/sites.js";
export function Narration({invoice}) {
  return <section className="card"><h2>Narration / amount calculation</h2><p>{invoice.billingType}  /  {invoice.site}  /  {String(invoice.periodFrom).slice(0,10)} to {String(invoice.periodTo).slice(0,10)}</p>
    <div className="sheet-scroll"><table className="trip-sheet"><thead><tr>{["Vehicle","Description","Quantity","Rate","Amount","Tax treatment"].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{invoice.lineItems.map((l,index)=><tr key={index}><td>{l.vehicleNumber || "Period"}</td><td>{l.description}</td><td>{Number(l.quantity || 0).toFixed(4).replace(/\.?0+$/,"")}</td><td>{currency(l.rate)}</td><td>{currency(l.amount)}</td><td>{l.taxable ? "Taxable" : "Other reimbursement"}</td></tr>)}</tbody></table></div>
    {(invoice.narration?.vehicles || []).map(v=><p key={v.vehicleId}>{v.vehicleNumber}: {v.agreement.name}{v.metrics.reason ? " - "+v.metrics.reason : ""}<br/>{invoice.billingType === "Variable" ?
      "Fuel basis: "+v.metrics.distanceKm+" KM / "+v.agreement.mileage+" mileage  x  "+currency(v.metrics.fuelRate ?? v.agreement.fuelRate) :
      "Shift: "+v.agreement.shiftHours+" hours  /  Contract KM: "+v.agreement.fixedKm+"  /  Rate: "+currency(v.agreement.fixedRate)}</p>)}
    {(invoice.narration?.periodCharges || []).map((c,i)=><p key={i}>{c.description}: {c.allocationNote}</p>)}
  </section>;
}
export default function BillingInvoiceForm() {
  const nav=useNavigate(),customers=useData("/masters/customers"),trips=useData("/trips"),agreements=useData("/masters/agreements"),vehicles=useData("/masters/vehicles"),shifts=useData("/settings/shifts"),managers=useData("/masters/fleetManagers");
  const [value,setValue]=useState({customerId:"",site:"Branded",billingType:"Fixed",tripIds:[],vehicleIds:[],metrics:[],managerIds:[],periodCharges:[],
    periodFrom:today().slice(0,7)+"-01",periodTo:today(),invoiceDate:today(),dueDate:today(),stateCode:"27",placeOfSupply:"Maharashtra",sacNo:"996601",cgstRate:0,sgstRate:0,igstRate:0,description:"",roundToRupee:true,taxConfirmed:false});
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const change=(k,v)=>{setValue(x=>({...x,[k]:v,...(k==="billingType"?{site:v==="Adhoc"?"Inbound":"Branded"}:{}),...(["customerId","site","billingType"].includes(k)?{tripIds:[],vehicleIds:[],metrics:[],managerIds:[]}: {})}));setPreview(null);};
  const metrics=(vehicleId,k,v)=>{setValue(x=>{const previous=x.metrics.find(m=>m.vehicleId===vehicleId) || {vehicleId,reason:""};
    const next={...previous,[k]:v};if(v==="" && k!=="reason") delete next[k];
    return {...x,metrics:[...x.metrics.filter(m=>m.vehicleId!==vehicleId),next]};});setPreview(null);};
  const simpleVehicle=id=>(agreements.data || []).some(a=>a.vehicleId===id && a.customerId===value.customerId && a.site===value.site && a.active && a.fleetRateId);
  const periodCharge=(index,k,v)=>change("periodCharges",value.periodCharges.map((c,i)=>i===index?{...c,[k]:v}:c));
  const eligible=(trips.data || []).filter(t=>String(t.customerId?._id)===value.customerId && (!value.site || t.site===value.site) && t.dutyKind!=="Branded" && ["Approved","Completed"].includes(t.status) && t.periodFrom.slice(0,10)>=value.periodFrom && t.periodTo.slice(0,10)<=value.periodTo);
  const fleet=(vehicles.data || []).filter(v=>v.branded && v.status!=="Inactive");
  async function review(e){e.preventDefault();setBusy(true);setError("");try{setPreview((await api.post("/invoices/preview",{...value,site:value.site || undefined})).data.data);}catch(e){setError(message(e));}finally{setBusy(false);}}
  async function save(){setBusy(true);setError("");try{const r=await api.post("/invoices",{...value,site:value.site || undefined,expectedTotal:preview.totalAmount,reviewToken:preview.reviewToken});nav("/invoices/"+r.data.data._id);}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <><h1>Create invoice</h1><p>Select the site, billing type and period. Review the narration before issuing.</p>
    {error && <p className="error">{error}</p>}{[customers,trips,agreements,vehicles].some(r=>r.error) && <p className="error">Unable to load billing options. Reload the page.</p>}
    <form onSubmit={review}><section className="card form-grid">
      <Field name="customerId" label="Billing customer" required options={(customers.data || []).map(c=>({value:c._id,label:c.companyName}))} value={value.customerId} onChange={change}/>
      {value.billingType==="Adhoc" && <Field name="site" label="Site" required={value.billingType !== "Adhoc"} options={[{value:"",label:"Legacy trips (site unspecified)"},...sites]} value={value.site} onChange={change}/>}
      <Field name="billingType" label="Invoice type" required options={["Fixed","Variable","Adhoc"]} value={value.billingType} onChange={change}/>
      {[["periodFrom","Billing period from","date"],["periodTo","Billing period to","date"],["invoiceDate","Invoice date","date"],["dueDate","Due date","date"],
        ["stateCode","Supply state code","text"],["placeOfSupply","Place of supply","text"],["sacNo","SAC","text"],["cgstRate","CGST %","number"],["sgstRate","SGST %","number"],["igstRate","IGST %","number"],
        ["description","Description (blank = generated)","textarea"],["roundToRupee","Round to rupee","checkbox"],["taxConfirmed","I verified tax configuration","checkbox"]].map(([name,label,type])=>
        <Field key={name} name={name} label={label} type={type} value={value[name]} onChange={change}/>)}
    </section>
    {value.billingType === "Adhoc" ? <section className="card"><h2>Select trips</h2>
      <button type="button" className="quiet" onClick={()=>change("tripIds",eligible.map(t=>t._id))}>Select all matching trips</button>
      {!eligible.length && <p>No approved adhoc trips match this customer, site and period.</p>}
      {eligible.map(t=><label className="check-row" key={t._id}><input type="checkbox" checked={value.tripIds.includes(t._id)} onChange={e=>change("tripIds",e.target.checked?[...value.tripIds,t._id]:value.tripIds.filter(id=>id!==t._id))}/>
        {t.tripId}  /  {t.vehicleNumber}  /  {currency(t.totalAmount)}</label>)}
    </section> : <section className="card"><h2>Select branded vehicles</h2><p>Select branded vehicles. Each vehicle uses its saved shift from the vehicle record. Fixed charges use the saved monthly KM allowance and matching monthly rate. Fixed invoices use the full agreed KM and manager salary without day-based proration.</p>
      {!fleet.length && <p>No branded vehicles. Add them in Vehicles and assign each a shift.</p>}
      {fleet.map(v=>{const m=value.metrics.find(m=>m.vehicleId===v._id) || {};return <div className="card" key={v._id}>
        <label className="check-row"><input type="checkbox" checked={value.vehicleIds.includes(v._id)} onChange={e=>{
          const selected=e.target.checked?[...value.vehicleIds,v._id]:value.vehicleIds.filter(id=>id!==v._id);
          setValue(x=>({...x,vehicleIds:selected,metrics:x.metrics.filter(m=>selected.includes(m.vehicleId))}));setPreview(null);
        }}/>{v.vehicleNumber}  /  {v.vehicleType}</label>
        {value.billingType === "Variable" && value.vehicleIds.includes(v._id) && <p>Branded shift logs, saved ADC/AMC rates, monthly parking and toll/entry, and fuel mileage/rate will be read automatically. Airport reimbursement is outside GST.</p>}
        {value.billingType === "Fixed" && value.vehicleIds.includes(v._id) && <p>Saved shift: {v.shiftHours || "Not assigned - edit the vehicle"} hours. Monthly KM: {shifts.data?.entries.find(s=>s.hours===v.shiftHours)?.monthlyKm ?? "Not configured"}.</p>}
      </div>;})}
    </section>}
    {value.billingType === "Fixed" && <section className="card"><h2>Select fleet managers</h2>{(managers.data || []).filter(m=>m.active && m.customerId===value.customerId && (value.site==="Branded" || m.site===value.site)).map(m=><label className="check-row" key={m._id}><input type="checkbox" checked={value.managerIds.includes(m._id)} onChange={e=>change("managerIds",e.target.checked?[...value.managerIds,m._id]:value.managerIds.filter(id=>id!==m._id))}/>{m.name} - {currency(m.monthlySalary)} / month</label>)}</section>}
    <details className="card"><summary>Optional adjustments / split allocation</summary><p>Add only this invoice's share of monthly passes or other charges. Record how it was divided.</p>
      {value.periodCharges.map((c,i)=><div className="card form-grid" key={i}>
        {[["description","Charge description","text"],["amount","Allocated amount","number"],["taxable","Taxable","checkbox"],["allocationNote","Allocation explanation","text"]].map(([name,label,type])=>
          <Field key={name} name={name} label={label} type={type} value={c[name]} onChange={(k,v)=>periodCharge(i,k,v)} required={type!=="checkbox"}/>)}
        <button type="button" className="quiet" onClick={()=>change("periodCharges",value.periodCharges.filter((_,n)=>n!==i))}>Remove charge</button>
      </div>)}
      <button type="button" className="quiet" onClick={()=>change("periodCharges",[...value.periodCharges,{description:"",amount:0,taxable:true,allocationNote:""}])}>+ Add period charge</button>
    </details>
    <button disabled={busy || !value.taxConfirmed || !(value.billingType === "Adhoc" ? value.tripIds.length : value.vehicleIds.length)}>Calculate narration & review</button></form>
    {preview && <><Narration invoice={preview}/><TaxSummary i={preview}/><button disabled={busy} onClick={save}>Issue invoice</button></>}
  </>;
}
