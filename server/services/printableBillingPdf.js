import {invoiceHeader} from "./invoiceHeaderService.js";
import {isCityInvoice,cityInvoiceRows} from "./invoicePresentationService.js";
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
  invoiceHeader(d,c,W);
  text(i.status==="Cancelled"?"CANCELLED TAX INVOICE":"TAX INVOICE",true,12,"center");d.y+=7;
  const put=(value,x,y,width,bold=false,size=8,align="left")=>{d.font(bold?"Times-Bold":"Times-Roman").fontSize(size).fillColor("black").text(String(value||""),x,y,{width,align});};
  const top=d.y,leftWidth=250,rightX=X+260,address=String(i.billingAddress||"");
  const metadataHeight=Math.max(83,d.font("Times-Roman").fontSize(8).heightOfString(address,{width:165})+49);
  const left=[["Invoice Number:",i.invoiceNumber],["Invoice Date:",date(i.invoiceDate)],["Invoice Period From:",date(i.periodFrom)],["Invoice Period To:",date(i.periodTo)],["Due Date:",date(i.dueDate)]];
  left.forEach(([label,value],n)=>{const y=top+n*metadataHeight/5;put(label,X+3,y,105);put(value,X+110,y,leftWidth-110,false,8,"right");d.moveTo(X+105,y+12).lineTo(X+leftWidth,y+12).lineWidth(.4).stroke();});
  put("Invoiced To:",rightX,top,70);put(i.invoicedTo,rightX+70,top,W-330,false,8,"right");d.moveTo(rightX+70,top+12).lineTo(X+W,top+12).stroke();
  put("Address:",rightX,top+18,70);put(address,rightX+70,top+18,W-330,false,8,"right");
  put("Location:",rightX,top+metadataHeight-16,70);put(i.location||i.site,rightX+70,top+metadataHeight-16,W-330,true,8,"right");
  d.y=top+metadataHeight+3;
  const stripY=d.y;
  const strips=[[`GSTIN: ${c.gstin||""}`,`SAC NO: ${i.sacNo||""}`,`CUSTOMER GSTIN: ${i.gstin||i.dhlGstin||""}`],[`STATE: ${i.state||""}`,`STATE CODE: ${c.stateCode||i.stateCode||""}`,`PLACE OF SUPPLY: ${i.placeOfSupply||""}  STATE CODE: ${i.stateCode||""}`]];
  strips.forEach((row,r)=>{let x=X;row.forEach((value,k)=>{const w=[150,100,275][k];d.rect(x,stripY+r*17,w,17).lineWidth(.5).stroke();put(value,x+3,stripY+r*17+4,w-6,false,7);x+=w;});});
  d.y=stripY+34;
  const items=i.lineItems||[],vehicleCount=new Set(items.filter(l=>l.vehicleNumber).map(l=>l.vehicleNumber)).size,managerCount=items.filter(l=>String(l.description).startsWith("Fleet management")).length;
  const groups=new Map();
  if(isCityInvoice(i)){for(const [label,amount] of cityInvoiceRows(i))groups.set(label,amount);}
  else if(i.billingType==="Variable"){
   const types=[...new Set((i.narration?.vehicles||[]).map(v=>v.agreement?.vehicleType).filter(Boolean))].join(", "),month=new Date(i.periodFrom).toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"}).toUpperCase();
   groups.set(`Branded ${types} fleet services - monthly variable transportation charges for ${vehicleCount} ${vehicleCount===1?"vehicle":"vehicles"}, ${month}`,Number(i.baseAmount||0));
   if(Number(i.nonTaxableAmount||0))groups.set("Reimbursement of Domestic Airport Entry Token Charges",Number(i.nonTaxableAmount));
  }else if(i.billingType==="Fixed")for(const l of items){const label=l.vehicleNumber?`Vehicle monthly fixed transportation charges - ${vehicleCount} ${vehicleCount===1?"vehicle":"vehicles"}`:String(l.description).startsWith("Fleet management")?`Fleet management charges - ${managerCount} ${managerCount===1?"manager":"managers"}`:l.description;groups.set(label,(groups.get(label)||0)+Number(l.amount));}
  else groups.set(i.description||"Transportation charges",Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0));
  const bodyTop=d.y,amountX=X+W-105;
  d.rect(X,bodyTop,W,19).fillAndStroke("#dddddd","black");put("DESCRIPTIONS & PARTICULARS",X+3,bodyTop+5,W-111,true,8,"center");put("AMOUNT (INR)",amountX+3,bodyTop+5,99,true,8,"center");
  let y=bodyTop+29;
  for(const [label,amount] of groups){put(label,X+5,y,W-120,false,9);const h=d.font("Times-Roman").fontSize(9).heightOfString(label,{width:W-120});put(money(amount),amountX+5,y,95,false,9,"right");y+=Math.max(19,h+8);}
  const bodyBottom=Math.max(bodyTop+130,y+18);d.rect(X,bodyTop,W,bodyBottom-bodyTop).lineWidth(.5).stroke();d.moveTo(amountX,bodyTop).lineTo(amountX,bodyBottom).stroke();
  y=bodyBottom;
  const totals=[["Total Amount",Number(i.baseAmount||0)+Number(i.nonTaxableAmount||0)],["Total Taxable Amount",i.baseAmount],[`Add Tax: CGST @ ${i.cgstRate||0}%`,i.cgstAmount],[`Add Tax: SGST @ ${i.sgstRate||0}%`,i.sgstAmount]];
  if(Number(i.igstRate)||Number(i.igstAmount))totals.push([`Add Tax: IGST @ ${i.igstRate||0}%`,i.igstAmount]);totals.push(["Round Off: (+/-)",i.roundOff],["Sub Total Amount",i.totalAmount]);
  totals.forEach(([label,amount],n)=>{if(n===totals.length-1)d.rect(X,y,W,15).fill("#dddddd");d.rect(X,y,W,15).strokeColor("black").stroke();d.moveTo(amountX,y).lineTo(amountX,y+15).stroke();put(label,X+5,y+3,W-115,true,8,"right");put(money(amount),amountX+5,y+3,95,true,8,"right");y+=15;});
  put("Amount In Words:",X+5,y+9,W-10,true,9);put(i.amountInWords,X+5,y+24,W-10,true,9);const wordsHeight=d.font("Times-Bold").fontSize(9).heightOfString(i.amountInWords||"",{width:W-10});y+=wordsHeight+34;
  d.rect(X,bodyBottom,W,y-bodyBottom).stroke();
  const notes=[`Pan Number: ${c.pan||""}`,`GSTIN Number: ${c.gstin||""}`,`Service Accounting Code: ${i.sacNo||""}`,c.disputeClause,c.interestClause,c.paymentClause,`Bank Details: ${c.bankName||""}`,`A/c no: ${c.bankAccount||""}, IFSC code: ${c.bankIfsc||""}`].filter(Boolean).join("\n"),noteWidth=W*.81;
  const noteHeight=d.font("Times-Roman").fontSize(8).heightOfString(notes,{width:noteWidth-10})+28;
  if(y+noteHeight+65>800){d.addPage();invoiceHeader(d,c,W);y=d.y;}
  d.rect(X,y,noteWidth,15).fillAndStroke("#dddddd","black");put("NOTE:",X+4,y+3,noteWidth-8,true,8);put(notes,X+5,y+20,noteWidth-10,false,8);d.rect(X,y,noteWidth,noteHeight).stroke();y+=noteHeight;
  d.rect(X,y,W,65).stroke();put("For M/s "+(c.name||"Lucky Transport Services"),X+W/2,y+5,W/2-5,true,9,"right");put("Authorised Signatory",X+W/2,y+40,W/2-5,true,9,"right");put("Thank you for Business",X,y+51,W,true,8,"center");d.y=y+65;
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
 if(section!=="narration")invoice();if(section!=="invoice" && !isCityInvoice(i)){if(section!=="narration")d.addPage();narration();}d.end();
 });
}
