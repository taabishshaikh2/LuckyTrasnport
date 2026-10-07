import PDFDocument from "pdfkit";
import { siteTripRows } from "./excelExportService.js";
import { siteColumns, durationText } from "../../shared/sites.js";
function billingPdf(i,balance) {
  return new Promise((resolve,reject)=>{
    const d=new PDFDocument({size:"A4",margin:35}); const chunks=[];
    d.on("data",b=>chunks.push(b));d.on("end",()=>resolve(Buffer.concat(chunks)));d.on("error",reject);
    const c=i.companySnapshot, money=n=>Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
    const text=(s,bold=false,size=9)=>d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size).fillColor("#142d4e").text(String(s || ""),d.page.margins.left,d.y,{width:d.page.width-d.page.margins.left-d.page.margins.right});
    const date=v=>new Date(v).toLocaleDateString("en-IN");
    text(c.name,true,17);text(c.tagline);text(c.address);text([c.phone,c.email].filter(Boolean).join(" | "));d.moveDown(.5);
    text(i.status === "Cancelled" ? "CANCELLED TAX INVOICE" : "TAX INVOICE",true,13);
    text("Invoice: "+i.invoiceNumber+"     Date: "+date(i.invoiceDate)+"     Due: "+date(i.dueDate));
    text("Period: "+date(i.periodFrom)+" to "+date(i.periodTo)+"     "+i.billingType+" / "+(i.site || i.location));
    text("Invoiced to: "+i.invoicedTo,true);text(i.billingAddress);
    text("GSTIN: "+c.gstin+"     Customer GSTIN: "+[i.gstin,i.dhlGstin].filter(Boolean).join(" / "));
    text("SAC: "+i.sacNo+"     Supply: "+i.placeOfSupply+"     State code: "+i.stateCode);d.moveDown(.5);
    text(i.description);d.moveDown(.4);
    const groups=new Map();for(const l of i.lineItems){const key=i.billingType === "Adhoc" ? (l.vehicleNumber ? "Transportation / overtime / toll charges" : l.description) : l.description;groups.set(key,(groups.get(key)||0)+l.amount);}
    for(const [label,value] of groups) text(label+" — INR "+money(value),true);
    d.moveDown(.5);
    for(const [label,value] of [["Taxable value",i.baseAmount],["Other reimbursements",i.nonTaxableAmount],
      ["CGST "+i.cgstRate+"%",i.cgstAmount],["SGST "+i.sgstRate+"%",i.sgstAmount],["IGST "+i.igstRate+"%",i.igstAmount],
      ["Round off",i.roundOff],["TOTAL",i.totalAmount]]) text(label+": INR "+money(value),label==="TOTAL",label==="TOTAL"?12:9);
    text(i.amountInWords,true);d.moveDown(.5);text("PAN: "+c.pan);text("Bank: "+c.bankName+" | Account: "+c.bankAccount+" | IFSC: "+c.bankIfsc);
    for(const note of [c.disputeClause,c.interestClause,c.paymentClause]) if(note) text(note,false,8);
    text("For "+c.name+" — Authorised Signatory",true);
    d.addPage();text("NARRATION / AMOUNT CALCULATION",true,14);
    text(i.invoiceNumber+" | "+date(i.periodFrom)+" to "+date(i.periodTo));d.moveDown();
    const headings=["Vehicle / charge","Quantity","Rate","Amount","Tax"];
    function table(headers,rows,widths,size=8){
      let y=d.y; const x=d.page.margins.left;const available=d.page.width-x-d.page.margins.right;
      const weight=widths.reduce((s,w)=>s+w,0); const actual=widths.map(w=>w*available/weight); const render=(values,bold)=>{
        d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);
        const height=Math.max(size <= 7 ? 19 : 22,...values.map((v,k)=>d.heightOfString(String(v ?? ""),{width:actual[k]-8})+10));
        if(y+height>d.page.height-d.page.margins.bottom-12){
          d.addPage({size:[d.page.width,d.page.height],margin:x});y=d.y;
          if(!bold) render(headers,true);
          d.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);
        }
        let xx=x;values.forEach((v,k)=>{d.rect(xx,y,actual[k],height).strokeColor("#d6dce4").stroke();d.text(String(v ?? ""),xx+4,y+5,{width:actual[k]-8});xx+=actual[k];});y+=height;d.y=y;
      };render(headers,true);rows.forEach(row=>render(row,false));d.y=y+12;
    }
    table(headings,i.lineItems.map(l=>[(l.vehicleNumber?l.vehicleNumber+" / ":"")+l.description,
      Number(l.quantity || 0).toFixed(4).replace(/\.?0+$/,""),money(l.rate),money(l.amount),l.taxable?"Taxable":"Other"]),[.46,.14,.14,.16,.1],7);
    for(const v of i.narration.vehicles || []) {
      text(v.vehicleNumber+" | "+v.agreement.name+" | Contract year: "+v.agreement.contractYear);
      text(i.billingType === "Fixed" ? "Shift: "+v.agreement.shiftHours+" hours | Contract KM: "+v.agreement.fixedKm+" | Rate: "+money(v.agreement.fixedRate) :
        "Fuel basis: "+v.metrics.distanceKm+" KM / "+v.agreement.mileage+" mileage x INR "+money(v.metrics.fuelRate ?? v.agreement.fuelRate));
      if(v.metrics.reason) text("Period inputs / allocation: "+v.metrics.reason);
    }
    for(const charge of i.narration.periodCharges || []) text(charge.description+" — allocation: "+charge.allocationNote);
    text("Taxable: INR "+money(i.baseAmount)+" | Other: INR "+money(i.nonTaxableAmount),true);
    if(i.tripSnapshot?.length){
      d.addPage({size:"A3",layout:"landscape",margin:25});text("TRIP DETAILS — "+(i.site || "Selected trips"),true,13);text(i.invoiceNumber);d.moveDown();
      const rows=siteTripRows(i.tripSnapshot).map(e=>siteColumns.map(([,k])=>["perTripHours","totalHours","gtInHours"].includes(k)?durationText(e[k]):e[k] ?? ""));
      table(siteColumns.map(c=>c[0]),rows,[.035,.065,.09,.065,.08,.055,.065,.08,.055,.055,.045,.05,.05,.07,.07,.07],7);
      for(const t of i.tripSnapshot) if(t.entries?.some(e=>e.closingDate && e.closingDate!==new Date(e.date || t.periodFrom).toISOString().slice(0,10))) text(t.tripId+" | Challan: "+(t.entries[0]?.challanNumber || "—")+" | Closing date: "+(t.entries.at(-1)?.closingDate || "—"));
    }
    d.end();
  });
}

export function invoicePdf(i, balance) {
  if (i.lineItems?.length) return billingPdf(i,balance);
  return new Promise((resolve, reject) => {
    const d = new PDFDocument({ size: "A4", margin: 45 });
    const chunks = [];
    d.on("data", (b) => chunks.push(b));
    d.on("end", () => resolve(Buffer.concat(chunks)));
    d.on("error", reject);
    const c = i.companySnapshot;
    const amt = (n) =>
      "INR " +
      Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const line = (label, value) =>
      d
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#24364b")
        .text(label + ": " + (value || "—"))
        .moveDown(0.5);
    d.font("Helvetica-Bold").fontSize(20).fillColor("#142d4e").text(c.name);
    d.font("Helvetica")
      .fontSize(10)
      .text(c.tagline || "")
      .text(c.address || "")
      .text([c.phone, c.email].filter(Boolean).join(" | "));
    d.moveDown();
    d.font("Helvetica-Bold")
      .fontSize(16)
      .text(i.status === "Cancelled" ? "CANCELLED TAX INVOICE" : "TAX INVOICE");
    d.moveDown();
    line("Invoice", i.invoiceNumber);
    line("Invoice date", new Date(i.invoiceDate).toLocaleDateString("en-IN"));
    line("Due date", new Date(i.dueDate).toLocaleDateString("en-IN"));
    line(
      "Billing period",
      new Date(i.periodFrom).toLocaleDateString("en-IN") +
        " - " +
        new Date(i.periodTo).toLocaleDateString("en-IN"),
    );
    line("Invoiced to", i.invoicedTo);
    line("Address", i.billingAddress);
    line("Location", i.location);
    line("Company GSTIN", c.gstin);
    line(
      "Customer / DHL GSTIN",
      [i.gstin, i.dhlGstin].filter(Boolean).join(" / "),
    );
    line("SAC", i.sacNo);
    line(
      "State / code / supply",
      [i.state, i.stateCode, i.placeOfSupply].join(" / "),
    );
    d.moveDown();
    d.font("Helvetica-Bold").text("Description");
    d.font("Helvetica").text(i.description);
    d.moveDown();
    for (const [label, value] of [
      ["Taxable value", i.baseAmount],
      ["CGST (" + i.cgstRate + "%)", i.cgstAmount],
      ["SGST (" + i.sgstRate + "%)", i.sgstAmount],
      ["IGST (" + i.igstRate + "%)", i.igstAmount],
      ["Round off", i.roundOff],
      ["Grand total", i.totalAmount],
      ["Received", balance.received],
      ["Outstanding", balance.outstanding],
    ])
      line(label, amt(value));
    d.font("Helvetica-Bold").text(i.amountInWords);
    d.moveDown();
    line("PAN", c.pan);
    line("Bank", c.bankName);
    line("Account", c.bankAccount);
    line("IFSC", c.bankIfsc);
    for (const note of [c.disputeClause, c.interestClause, c.paymentClause])
      if (note) d.font("Helvetica").fontSize(9).text(note).moveDown(0.3);
    d.moveDown()
      .font("Helvetica-Bold")
      .text("Authorised Signatory", { align: "right" });
    d.end();
  });
}
