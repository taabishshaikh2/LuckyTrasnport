import PDFDocument from "pdfkit";
export function printableBillingPdf(i, section="all") {
 return new Promise((resolve,reject)=>{
 const d=new PDFDocument({size:"A4",margin:35}), chunks=[];
 d.on("data",b=>chunks.push(b));d.on("end",()=>resolve(Buffer.concat(chunks)));d.on("error",reject);
 const c=i.companySnapshot||{}, W=525, X=35;
 const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
 const date=v=>v?new Date(v).toLocaleDateString("en-GB"):"";
 const text=(s,bold=false,size=9,align="left")=>{d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size).fillColor("black").text(String(s||""),X,d.y,{width:W,align});};
 function table(headers,rows,weights,size=8){
  const compact=size<=7,padding=compact?2:5;
  const widths=weights.map(w=>W*w/weights.reduce((a,b)=>a+b,0));let y=d.y;
  function row(values,bold=false){
   d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);
   const h=Math.max(compact?14:24,...values.map((v,k)=>d.heightOfString(String(v??""),{width:widths[k]-10})+(compact?5:12)));
   if(y+h>(compact?780:745)){d.addPage();y=35;if(!bold)row(headers,true);d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);}
   let x=X;values.forEach((v,k)=>{d.rect(x,y,widths[k],h).strokeColor("black").lineWidth(.5).stroke();d.text(String(v??""),x+5,y+padding+1,{width:widths[k]-10,align:k===values.length-1?"right":"left"});x+=widths[k];});y+=h;d.y=y;
  }
  row(headers,true);rows.forEach(r=>row(r));d.y=y+(compact?6:12);
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
  const variable=i.billingType==="Variable",vs=i.narration?.vehicles||[];
  const monthLabel=new Date(i.periodFrom).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).toUpperCase();
  if(variable){
   const types=[...new Set(vs.map(v=>v.agreement?.vehicleType).filter(Boolean))].join(', '),count=new Set((i.lineItems||[]).map(l=>l.vehicleNumber).filter(Boolean)).size;
   const years=[...new Set(vs.map(v=>v.agreement?.contractYear).filter(Boolean))].join(', ');
   for(const [label,value] of [['VENDOR NAME:',c.name||'Lucky Transport Services'],['VEHICLE TYPE:','BRANDED '+types],['VEHICLE QTY:',count+' NOS'],['LOCATION:',i.location||i.billingAddress||''],['SUMMARY:','VARIABLE COST FOR MONTH OF '+monthLabel],['FLEET SERVICES:',years?years+' YEAR':'BRANDED VEHICLES']]){
    const y=d.y;d.font('Helvetica-Bold').fontSize(8).text(label,X,y,{width:110});d.text(value,X+115,y,{width:W-115});d.y=Math.max(d.y,y+12);
   }
   d.moveDown(.5);
  }else{
   text("NARRATION / AMOUNT CALCULATION",true,14);d.moveDown();
   for(const str of [`VENDOR NAME: ${c.name||"Lucky Transport Services"}`,`INVOICE: ${i.invoiceNumber}`,`LOCATION: ${i.location||i.site||""}`,`SUMMARY: ${i.billingType.toUpperCase()} COST | ${date(i.periodFrom)} to ${date(i.periodTo)}`])text(str,true);
   d.moveDown();
  }
  if(i.billingType==="Fixed"){
   const vehicle=(i.lineItems||[]).filter(l=>l.vehicleNumber),management=(i.lineItems||[]).filter(l=>l.description.startsWith("Fleet management"));
   text("1) VEHICLE FIXED COST",true,11);d.moveDown(.5);
   table(["Sr. no.","Vehicle no.","Vehicle type","Monthly fixed KM","Per KM rate","TOTAL AMOUNT"],vehicle.map((l,k)=>[k+1,l.vehicleNumber,(i.narration?.vehicles||[]).find(v=>v.vehicleNumber===l.vehicleNumber)?.agreement?.vehicleType||"",Number(l.quantity),money(l.rate),money(l.amount)]).concat([["","","","","Total",money(vehicle.reduce((s,l)=>s+l.amount,0))]]),[.5,1.4,1.2,1.1,1,1.3]);
   text("2) MANAGEMENT CHARGES",true,11);d.moveDown(.5);
   table(["Sr. no.","Fleet management","Quantity","Rate per month","Amount"],management.map((l,k)=>[k+1,l.description.replace("Fleet management - ",""),Number(l.quantity),money(l.rate),money(l.amount)]).concat([["","","","Total",money(management.reduce((s,l)=>s+l.amount,0))]]),[.5,2, .7,1.2,1.2]);
   const other=(i.lineItems||[]).filter(l=>!vehicle.includes(l)&&!management.includes(l));if(other.length)table(["Other charge","Quantity","Rate","Amount"],other.map(l=>[l.description,l.quantity,money(l.rate),money(l.amount)]),[3,1,1,1]);
  }else{
   const groups=[['1) Fuel Diesel Rate',l=>l.description.startsWith('Fuel reimbursement'),'fuel'],['2) Additional Services Charges',l=>l.description.startsWith('Additional services'),'adc'],['3) Toll & Entry Charges & Parking Charges',l=>/parking|toll \/ entry/i.test(l.description),'parking'],['4) Reimbursement Domestic Airport Entry Fees',l=>l.description.startsWith('Airport'),'airport'],['5) AMC CHARGES',l=>l.description.startsWith('AMC'),'amc']];
   const included=new Set();
   for(const [heading,match,kind] of groups){
    let rows=(i.lineItems||[]).filter(match);rows.forEach(l=>included.add(l));
    if(kind==='parking'){const merged=new Map();for(const l of rows){const prior=merged.get(l.vehicleNumber);merged.set(l.vehicleNumber,{...l,quantity:1,rate:(prior?.amount||0)+l.amount,amount:(prior?.amount||0)+l.amount});}rows=Array.from(merged.values());}
    if(d.y>690){d.addPage();text('VARIABLE COST - CONTINUED',true,9);d.moveDown(.5);}
    text(heading,true,8);d.moveDown(.3);
    const headers=kind==='fuel'?['Sr no.','Vehicle type','No. of vehicle','Total KM','Mileage','Fuel Rate','Amount']:kind==='adc'?['Sr no.','Vehicle type','No. of vehicle','Nos of days','Nos of Shift','Rate','Amount']:kind==='amc'?['Sr no.','Vehicle type','No. of vehicle','Total KM','Rate in Rs','Amount']:['Sr no.','Vehicle type','No. of vehicle','Description','Nos of Token','Rate in Rs','Amount'];
    const values=rows.map((l,k)=>{const v=vs.find(v=>v.vehicleNumber===l.vehicleNumber),base=[k+1,v?.agreement?.vehicleType||'',l.vehicleNumber];
     return kind==='fuel'?[...base,v?.metrics?.distanceKm??'',v?.agreement?.mileage??'',money(l.rate),money(l.amount)]:kind==='adc'?[...base,Number(l.quantity/3).toFixed(2),Number(l.quantity).toFixed(2),money(l.rate),money(l.amount)]:kind==='amc'?[...base,Number(l.quantity).toFixed(2),money(l.rate),money(l.amount)]:[...base,kind==='airport'?'Domestic airport entry':new Date(i.periodFrom).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).toUpperCase(),Number(l.quantity).toFixed(2),money(l.rate),money(l.amount)];
    });
    const total=Array(headers.length).fill('');total[headers.length-2]='Total';if(kind==='fuel'||kind==='amc')total[3]=Number(values.reduce((sum,row)=>sum+Number(row[3]||0),0)).toFixed(2);total[headers.length-1]=money(rows.reduce((sum,l)=>sum+l.amount,0));
    table(headers,values.concat([total]),kind==='amc'?[.4,1.4,1.4,1,1,1.2]:[.4,1.35,1.4,1.25,.7,1,1.15],7);
   }
   const other=(i.lineItems||[]).filter(l=>!included.has(l));if(other.length)table(['Other charge','Quantity','Rate','Amount'],other.map(l=>[l.description,l.quantity,money(l.rate),money(l.amount)]),[3,1,1,1],7);

  }
  if(variable){table([`Total Variable Cost For ${monthLabel}`,money(Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0))],[],[4,1],7);}else table([`Total ${i.billingType.toLowerCase()} cost before GST`,"AMOUNT (INR)"],[["Total",money(Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0))]],[4,1]);
  d.moveDown();const signY=d.y;d.font("Helvetica-Bold").fontSize(8).text("DHL Supervisor",X,signY,{width:W/2});d.text("Vendor Sign",X+W/2,signY,{width:W/2,align:"right"});
 }
 if(section!=="narration")invoice();if(section!=="invoice"){if(section!=="narration")d.addPage();narration();}d.end();
 });
}
