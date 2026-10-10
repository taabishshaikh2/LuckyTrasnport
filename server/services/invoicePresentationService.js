export function isCityInvoice(i){return i.billingType==="Adhoc"&&(["Inbound","Outbound"].includes(i.site)||i.tripSnapshot?.length>0&&i.tripSnapshot.every(t=>["Inbound","Outbound"].includes(t.site)));}
export function cityInvoiceRows(i){
 const items=i.lineItems||[],trips=i.tripSnapshot||[],sum=key=>items.reduce((n,l)=>n+Number(l[key]||0),0);
 const month=new Date(i.periodFrom).toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"}).toUpperCase();
 const types=[...new Set(trips.map(t=>t.vehicleType).filter(Boolean))].join(", ");
 const sites=[...new Set(trips.map(t=>t.site).filter(Boolean))].join(" / ")||i.site;
 if(!items.length)return [[i.description||`Local transportation charges for Adhoc vehicles - ${sites}, ${month}`,Number(i.baseAmount||0)],['Extra Hours Cost',0],[`Monthly passes for trucks & tempos at Air Cargo Complex for ${month}`,0]];
 const base=sum("baseAmount"),ot=sum("overtimeAmount"),parking=sum("tollParking")+items.filter(l=>l.category==="Adhoc monthly parking").reduce((n,l)=>n+Number(l.amount||0),0),night=sum("nightDetentionAmount");
 const rows=[[`Local transportation charges for Adhoc truck & jeep vehicle services provided for ${sites}${types?" ("+types+")":""}, ${month}`,base],["Extra Hours Cost",ot],[`Monthly passes for trucks & tempos at Air Cargo Complex for ${month}`,parking]];
 if(night)rows.push(["Night detention charges",night]);
 const other=Math.round((Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0)-base-ot-parking-night)*100)/100;
 if(other)rows.push(["Other charges / adjustments",other]);
 return rows;
}
