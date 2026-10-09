import PDFDocument from "pdfkit";
export function printableBillingPdf(i, section="all") {
 return new Promise((resolve,reject)=>{
 const d=new PDFDocument({size:"A4",margin:35}), chunks=[];
 d.on("data",b=>chunks.push(b));d.on("end",()=>resolve(Buffer.concat(chunks)));d.on("error",reject);
 const c=i.companySnapshot||{}, W=525, X=35;
 const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
 const date=v=>v?new Date(v).toLocaleDateString("en-GB"):"";
 const text=(s,bold=false,size=9,align="left")=>{d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size).fillColor("black").text(String(s||""),X,d.y,{width:W,align});};
 function table(headers,rows,weights){
  const widths=weights.map(w=>W*w/weights.reduce((a,b)=>a+b,0));let y=d.y;
  function row(values,bold=false){
   d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(8);
   const h=Math.max(24,...values.map((v,k)=>d.heightOfString(String(v??""),{width:widths[k]-10})+12));
   if(y+h>745){d.addPage();y=35;if(!bold)row(headers,true);d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(8);}
   let x=X;values.forEach((v,k)=>{d.rect(x,y,widths[k],h).strokeColor("black").lineWidth(.5).stroke();d.text(String(v??""),x+5,y+6,{width:widths[k]-10,align:k===values.length-1?"right":"left"});x+=widths[k];});y+=h;d.y=y;
  }
  row(headers,true);rows.forEach(r=>row(r));d.y=y+12;
 }
 function invoice(){
  text(c.name||"LUCKY TRANSPORT SERVICES",true,19,"center");text(c.tagline,false,9,"center");text(c.address,false,8,"center");text([c.email,c.phone].filter(Boolean).join(" | "),false,8,"center");d.moveDown(.5);
  text(i.status==="Cancelled"?"CANCELLED TAX INVOICE":"TAX INVOICE",true,13,"center");d.moveDown(.5);
  table(["Invoice details","Invoice to"],[[`Invoice number: ${i.invoiceNumber}\nInvoice date: ${date(i.invoiceDate)}\nPeriod: ${date(i.periodFrom)} to ${date(i.periodTo)}\nDue date: ${date(i.dueDate)}`,`${i.invoicedTo||""}\n${i.billingAddress||""}\nLocation: ${i.location||i.site||""}`],[`GSTIN: ${c.gstin||""}\nSAC: ${i.sacNo||""}\nState code: ${i.stateCode||""}`,`Customer GSTIN: ${i.gstin||i.dhlGstin||""}\nPlace of supply: ${i.placeOfSupply||""}`]],[1,1]);
  const items=i.lineItems||[];
  const vehicleCount=new Set(items.filter(l=>l.vehicleNumber).map(l=>l.vehicleNumber)).size;
  const managerCount=items.filter(l=>l.description.startsWith("Fleet management")).length;
  const vehicleLabel=`Vehicle monthly fixed transportation charges - ${vehicleCount} ${vehicleCount===1?"vehicle":"vehicles"}`;
  const managerLabel=`Fleet management charges - ${managerCount} ${managerCount===1?"manager":"managers"}`;
  const groups=new Map();for(const l of items){const label=i.billingType==="Fixed"?(l.vehicleNumber?vehicleLabel:l.description.startsWith("Fleet management")?managerLabel:l.description):l.description;groups.set(label,(groups.get(label)||0)+Number(l.amount));}
  table(["DESCRIPTION & PARTICULARS","AMOUNT (INR)"],Array.from(groups,([k,v])=>[k,money(v)]),[4,1]);
  table(["Invoice summary","AMOUNT (INR)"],[["Total taxable value",money(i.baseAmount)],...(i.nonTaxableAmount?[["Other reimbursements (outside GST)",money(i.nonTaxableAmount)]]:[]),[`CGST ${i.cgstRate||0}%`,money(i.cgstAmount)],[`SGST ${i.sgstRate||0}%`,money(i.sgstAmount)],[`IGST ${i.igstRate||0}%`,money(i.igstAmount)],["Round off",money(i.roundOff)],["GRAND TOTAL",money(i.totalAmount)]],[4,1]);
  text("Amount in words",true);text(i.amountInWords);d.moveDown(.5);
  text("NOTE",true);for(const note of [`PAN: ${c.pan||""}`,`Bank: ${c.bankName||""} | Account: ${c.bankAccount||""} | IFSC: ${c.bankIfsc||""}`,c.disputeClause,c.interestClause,c.paymentClause])if(note)text(note,false,8);
  d.moveDown();text("For "+(c.name||"Lucky Transport Services"),true,9,"right");d.moveDown();text("Authorised Signatory",false,9,"right");text("Thank you for business",false,8,"center");
 }
 function narration(){
  text("NARRATION / AMOUNT CALCULATION",true,14);d.moveDown();
  for(const s of [`VENDOR NAME: ${c.name||"Lucky Transport Services"}`,`INVOICE: ${i.invoiceNumber}`,`LOCATION: ${i.location||i.site||""}`,`SUMMARY: ${i.billingType.toUpperCase()} COST | ${date(i.periodFrom)} to ${date(i.periodTo)}`])text(s,true);
  d.moveDown();
  if(i.billingType==="Fixed"){
   const vehicle=(i.lineItems||[]).filter(l=>l.vehicleNumber),management=(i.lineItems||[]).filter(l=>l.description.startsWith("Fleet management"));
   text("1) VEHICLE FIXED COST",true,11);d.moveDown(.5);
   table(["Sr. no.","Vehicle no.","Vehicle type","Monthly fixed KM","Per KM rate","TOTAL AMOUNT"],vehicle.map((l,k)=>[k+1,l.vehicleNumber,(i.narration?.vehicles||[]).find(v=>v.vehicleNumber===l.vehicleNumber)?.agreement?.vehicleType||"",Number(l.quantity),money(l.rate),money(l.amount)]).concat([["","","","","Total",money(vehicle.reduce((s,l)=>s+l.amount,0))]]),[.5,1.4,1.2,1.1,1,1.3]);
   text("2) MANAGEMENT CHARGES",true,11);d.moveDown(.5);
   table(["Sr. no.","Fleet management","Quantity","Rate per month","Amount"],management.map((l,k)=>[k+1,l.description.replace("Fleet management - ",""),Number(l.quantity),money(l.rate),money(l.amount)]).concat([["","","","Total",money(management.reduce((s,l)=>s+l.amount,0))]]),[.5,2, .7,1.2,1.2]);
   const other=(i.lineItems||[]).filter(l=>!vehicle.includes(l)&&!management.includes(l));if(other.length)table(["Other charge","Quantity","Rate","Amount"],other.map(l=>[l.description,l.quantity,money(l.rate),money(l.amount)]),[3,1,1,1]);
  }else{
   const vs=i.narration?.vehicles||[];
   const groups=[['1) FUEL COST',l=>l.description.startsWith('Fuel reimbursement')],['2) ADDITIONAL SERVICES CHARGES',l=>l.description.startsWith('Additional services')],['3) TOLL, ENTRY & PARKING CHARGES',l=>/parking|toll \/ entry/i.test(l.description)],['4) AIRPORT ENTRY REIMBURSEMENT (OUTSIDE GST)',l=>l.description.startsWith('Airport')],['5) AMC CHARGES',l=>l.description.startsWith('AMC')]];
   const included=new Set();
   for(const [heading,match] of groups){
    const rows=(i.lineItems||[]).filter(match);rows.forEach(l=>included.add(l));if(!rows.length)continue;
    text(heading,true,10);d.moveDown(.5);
    const fuel=heading.startsWith('1)'),adc=heading.startsWith('2)');
    const headers=fuel?['Vehicle no.','Vehicle type','Total KM','Mileage','Fuel rate','Amount']:adc?['Vehicle no.','Vehicle type','Extra days (24h)','8-hour shifts','Rate','Amount']:['Vehicle no.','Vehicle type / charge','Quantity','Rate','Amount'];
    const values=rows.map(l=>{const v=vs.find(v=>v.vehicleNumber===l.vehicleNumber),type=v?.agreement?.vehicleType||l.description;
      return fuel?[l.vehicleNumber,type,v?.metrics?.distanceKm??'',v?.agreement?.mileage??'',money(l.rate),money(l.amount)]:adc?[l.vehicleNumber,type,Number(l.quantity/3).toFixed(2),Number(l.quantity).toFixed(2),money(l.rate),money(l.amount)]:[l.vehicleNumber,type,Number(l.quantity).toFixed(2),money(l.rate),money(l.amount)];});
    const total=Array(headers.length).fill('');total[headers.length-2]='Total';total[headers.length-1]=money(rows.reduce((sum,l)=>sum+l.amount,0));
    table(headers,values.concat([total]),fuel||adc?[1.4,1.4,1, .8,1,1.2]:[1.4,2,1,1,1.2]);
   }
   const other=(i.lineItems||[]).filter(l=>!included.has(l));if(other.length)table(['Other charge','Quantity','Rate','Amount'],other.map(l=>[l.description,l.quantity,money(l.rate),money(l.amount)]),[3,1,1,1]);
   for(const v of vs)if(v.metrics?.reason){text(v.vehicleNumber+': '+v.metrics.reason,false,8);d.moveDown(.5);}

  }
  table([`Total ${i.billingType.toLowerCase()} cost before GST`,"AMOUNT (INR)"],[["Total",money(Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0))]],[4,1]);
  d.moveDown();text("DHL Supervisor                                      Vendor Sign",true);
 }
 if(section!=="narration")invoice();if(section!=="invoice"){if(section!=="narration")d.addPage();narration();}d.end();
 });
}
