import {logAdcAmounts,brandedAdc} from "../../shared/brandedLogs.js";
import XLSX from "xlsx-js-style";
import { sites, siteColumns, durationText } from "../../shared/sites.js";
import { AppError } from "../utils/errors.js";
export function siteTripRows(trips) {
  return trips.map((t,index)=>{
    const e=t.entries?.[0] || {}, last=t.entries?.at(-1) || e;
    return {...e,srNo:index+1,date:new Date(t.periodFrom).toISOString().slice(0,10),
      vehicleNo:t.vehicleNumber,vehicleType:t.vehicleType,customerName:e.customerName || e.chaName || t.customerId?.companyName || "",
      distanceKm:t.distanceKm ?? e.distanceKm,ratePerKm:t.rateSnapshot?.perKmRate ?? "",
      pickupLocation:e.pickupLocation || t.pickupLocation,dropLocation:e.dropLocation || t.dropLocation,
      closingTime:last.closingTime,closingDate:last.closingDate,
      perTripHours:t.baseDutyHours ?? e.perTripHours,totalHours:t.totalHours,gtInHours:t.overtimeHours ?? e.gtInHours,
      sdcCharges:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.sdcCharges : (t.subtotal ?? (t.totalAmount-t.extraAmount)),
      tollParking:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.tollParking : t.extraAmount,
      totalServiceCharges:t.dutyKind === "Branded" && t.rateSnapshot?.source !== "TripRate" ? e.totalServiceCharges : t.totalAmount};
  });
}
export function siteWorkbook(trips,site,invoice,company) {
  const profile=sites.find(s=>s.value===site);
  if (!profile) throw new AppError("Select one of the four sites");
  const book=XLSX.utils.book_new();
  const data=siteTripRows(trips);
  const exportColumns = data.length ? [...siteColumns.slice(0,13), ["TOTAL KM", "distanceKm"], ["RATE PER KM", "ratePerKm"], ...siteColumns.slice(13)] : siteColumns;
  const moneyKeys = new Set(["sdcCharges", "tollParking", "totalServiceCharges", "ratePerKm"]);
  const durationKeys = new Set(["perTripHours", "totalHours", "gtInHours"]);
  const sum = key => data.reduce((n,e)=>n+Number(e[key] || 0),0);
  const headerRows = data.length ? 5 : 0;
  const width = exportColumns.length;
  const table = [];
  if (data.length) {
    const dates = data.map(e=>e.date).sort();
    const period = [invoice?.periodFrom || dates[0],invoice?.periodTo || dates.at(-1)].map(v=>new Date(v).toISOString().slice(0,10)).join(" to ");
    for (const [label,value,summary,amount] of [
      ["Vendor Name",invoice?.companySnapshot?.name || company?.name || process.env.COMPANY_NAME || "Lucky Transport Services","PER TRIP AMOUNT",sum("sdcCharges")],
      ["SERVICE",profile.label,"EXTRA HRS",durationText(sum("gtInHours"))],
      ["PERIOD",period,"FASTAG & TOLL",sum("tollParking")],
      ["COST CODE",invoice?.costCode || "","Total Amount",sum("totalServiceCharges")],
    ]) {
      const row=Array(width).fill(""); row[0]=label;row[3]=value;row[9]=summary;row[width-1]=amount;table.push(row);
    }
    table.push([]);
  }
  table.push(exportColumns.map(c=>c[0]));
  for (const e of data) table.push(exportColumns.map(([,k])=>durationKeys.has(k) ? durationText(e[k]) : k==="date" ? e[k].split("-").reverse().join("-") : e[k] ?? ""));
  if (data.length) table.push(exportColumns.map(([,k],i)=>i===0 ? "TOTAL" : durationKeys.has(k) ? durationText(sum(k)) : ["distanceKm","sdcCharges","tollParking","totalServiceCharges"].includes(k) ? sum(k) : ""));
  const sheet=XLSX.utils.aoa_to_sheet(table);
  sheet["!cols"]=exportColumns.map(([,k])=>({wch:({srNo:6,date:13,vehicleNo:18,vehicleType:14,awbNumber:18,customerName:18,pickupLocation:11,dropLocation:14,sdcCharges:16,tollParking:18,totalServiceCharges:18})[k] || 12}));
  sheet["!rows"]=table.map((_,r)=>({hpt:r===headerRows ? 62 : r<headerRows ? 18 : 21}));
  sheet["!merges"]=data.length ? [0,1,2,3].flatMap(r=>[
    {s:{r,c:0},e:{r,c:2}}, {s:{r,c:3},e:{r,c:8}}, {s:{r,c:9},e:{r,c:width-2}},
  ]) : [];
  const border={style:"thin",color:{rgb:"000000"}};
  for(let r=0;r<table.length;r++) for(let c=0;c<width;c++) {
    const addr=XLSX.utils.encode_cell({r,c}); const cell=sheet[addr] ||= {t:"s",v:""};
    cell.s={font:{name:"Arial",sz:r>headerRows ? 10 : 11,bold:r<=headerRows || r===table.length-1},
      alignment:{vertical:"center",horizontal:r<headerRows ? "left" : "center",wrapText:true},
      ...(r>=headerRows ? {border:{top:border,bottom:border,left:border,right:border}} : {})};
    if(r>headerRows && moneyKeys.has(exportColumns[c][1]) && cell.t==="n") {cell.z="#,##0.00";cell.s.alignment.horizontal="right";}
    if(r<headerRows && c===width-1 && cell.t==="n") cell.z=r===1 ? "0.00" : "#,##0.00";
  }
  sheet["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:headerRows,c:0},e:{r:headerRows+data.length,c:width-1}})};
  XLSX.utils.book_append_sheet(book,sheet,profile.value + " Trips");
  if (data.length) {
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
      ["SR.NO","Trip ID","Challan Number","Closing Date","HU Number","Remarks"],
      ...data.map((e,i)=>[i+1,trips[i].tripId,e.challanNumber || "",e.closingDate || "",e.huNumber || "",e.remarks || ""]),
    ]),"References");
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(trips.flatMap(t=>(t.entries || []).map(e=>({Trip:t.tripId,...e,date:String(e.date).slice(0,10)})))),"Duty records");
  }
  if (invoice) XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
    ["Vehicle","Description","Quantity","Rate","Amount","Taxable","Allocation / reason"],
    ...(invoice.lineItems || []).map(l=>[l.vehicleNumber || "Period",l.description,l.quantity,l.rate,l.amount,l.taxable ? "Yes" : "No",l.allocationNote || ""]),
    ...(invoice.narration?.vehicles || []).map(v=>[v.vehicleNumber,invoice.billingType === "Fixed" ? "Fixed KM basis" : "Fuel basis",invoice.billingType === "Fixed" ? v.agreement.fixedKm : v.metrics.distanceKm,invoice.billingType === "Fixed" ? v.agreement.shiftHours : v.agreement.mileage,invoice.billingType === "Fixed" ? v.agreement.fixedRate : (v.metrics.fuelRate ?? v.agreement.fuelRate),"",v.metrics.reason || v.agreement.name]),
    ["","Taxable value","","",invoice.baseAmount], ["","Other reimbursements","","",invoice.nonTaxableAmount || 0],
    ["","CGST","","",invoice.cgstAmount],["","SGST","","",invoice.sgstAmount],["","IGST","","",invoice.igstAmount],
    ["","Round off","","",invoice.roundOff],["","Invoice total","","",invoice.totalAmount],
  ]),"Narration");
  return XLSX.write(book,{type:"buffer",bookType:"xlsx"});
}
export const columns = [
  ["Sr No", "srNo"],
  ["Date", "date"],
  ["Challan Number", "challanNumber"],
  ["Vehicle No", "vehicleNo"],
  ["CHA Name", "chaName"],
  ["Vehicle Type", "vehicleType"],
  ["HU No", "huNumber"],
  ["Origin", "pickupLocation"],
  ["Destination", "dropLocation"],
  ["Opening Time", "openingTime"],
  ["MRB Arrival Time", "mrbArrivalTime"],
  ["Closing Time", "closingTime"],
  ["Closing Date", "closingDate"],
  ["Per Trip Hrs", "perTripHours"],
  ["Total Hrs", "totalHours"],
  ["O.T. In Hrs", "gtInHours"],
  ["O.T. In KM", "overtimeKm"],
  ["Trip Charges", "tripCharges"],
  ["OT Amount", "gtAmount"],
  ["Toll And Parking", "tollParking"],
  ["Total SVC Charges", "totalServiceCharges"],
  ["KM", "distanceKm"],
  ["Billing Group", "billingGroup"],
  ["Remarks", "remarks"],
];
const duration = (v) => {
  const m = Math.round(Number(v || 0) * 60);
  return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
};
function bookBuffer(rows, name) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map(() => ({ wch: 22 }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, rows.length - 1), c: rows[0].length - 1 },
    }),
  };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, name);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}
export async function allSitesWorkbook(trips,company) {
  const book=XLSX.utils.book_new();
  for (const site of sites) {
    const matching=trips.filter(t=>t.site===site.value);
    const sub=XLSX.read(siteWorkbook(matching,site.value,undefined,company),{type:"buffer",cellStyles:true});
    for (const name of sub.SheetNames) XLSX.utils.book_append_sheet(book,sub.Sheets[name],(name.startsWith(site.value)?name:site.value+" "+name).slice(0,31));
  }
  const legacy=trips.filter(t=>!t.site);
  if (legacy.length) {
    const old=XLSX.read(await tripWorkbook(legacy),{type:"buffer"});
    XLSX.utils.book_append_sheet(book,old.Sheets[old.SheetNames[0]],"Legacy Trips");
  }
  return XLSX.write(book,{type:"buffer",bookType:"xlsx"});
}
export function importTemplate(site) {
  if (site) return siteWorkbook([],site);
  return bookBuffer([columns.map((x) => x[0])], "Trips");
}
export async function tripWorkbook(trips) {
  const rows = [
    [
      ...columns.map((x) => x[0]),
      "Trip ID",
      "Customer",
      "Status",
      "Calculated Base Amount",
      "Calculated OT Amount",
      "Calculated Total",
    ],
  ];
  for (const t of trips) {
    const entries = t.entries.length
      ? t.entries
      : [
          {
            date: t.periodFrom,
            totalHours: t.totalHours,
            distanceKm: t.distanceKm,
          },
        ];
    entries.forEach((e, i) => {
      const v = {
        ...e,
        vehicleNo: e.vehicleNo || t.vehicleNumber,
        vehicleType: e.vehicleType || t.vehicleType,
        pickupLocation: e.pickupLocation || t.pickupLocation,
        dropLocation: e.dropLocation || t.dropLocation,
      };
      rows.push([
        ...columns.map(([_, key]) =>
          key === "date"
            ? new Date(v.date).toISOString().slice(0, 10)
            : ["perTripHours", "totalHours", "gtInHours"].includes(key)
              ? duration(v[key])
              : (v[key] ?? ""),
        ),
        t.tripId,
        t.customerId?.companyName || "",
        t.status,
        i === 0 ? t.baseAmount : "",
        i === 0 ? t.overtimeAmount : "",
        i === 0 ? t.totalAmount : "",
      ]);
    });
  }
  return bookBuffer(rows, "Trips");
}

export function brandedWorkbook(logs,vehicles,offs=[],context={}){
 const wb=XLSX.utils.book_new();
 const groups=new Map();for(const l of logs){const key=String(l.vehicleId)+":"+String(l.customerId)+":"+new Date(l.date).toISOString().slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(l);}
 let sheetIndex=0;
 for(const rows of groups.values()){
  const v=vehicles.find(v=>String(v._id)===String(rows[0].vehicleId)),month=new Date(rows[0].date).toISOString().slice(0,7);
  const off=offs.filter(o=>String(o.vehicleId)===String(v._id)&&String(o.customerId)===String(rows[0].customerId)&&new Date(o.date).toISOString().slice(0,7)===month);
  const adc=logAdcAmounts(rows,v.shiftHours,v.adcRate||0,off.length||undefined,v.includedHours,off);
  const km=rows.reduce((s,l)=>s+Number(l.distanceKm||0),0),hours=rows.reduce((s,l)=>s+Number(l.totalHours||0),0),adcTotal=Array.from(adc.values()).reduce((a,b)=>a+b,0),airportTotal=rows.reduce((s,l)=>s+Number(l.airportFee||0),0);
  const start=new Date(month+'-01'),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)),days=end.getUTCDate();
  const type=v.customVehicleType||v.vehicleType||'',agreement=v.snapshot?.agreement;
  const matching=(context.rates||[]).filter(r=>String(r.customerId)===String(rows[0].customerId)&&[type,v.vehicleType].includes(r.vehicleType)&&r.shiftHours===v.shiftHours&&new Date(r.effectiveFrom)<=start&&(!r.effectiveTo||new Date(r.effectiveTo)>=end));
  const fixedKm=agreement?.fixedKm??context.shifts?.find(s=>s.hours===v.shiftHours)?.monthlyKm, fixedRate=agreement?.fixedRate??(matching.length===1?matching[0].fixedRate:undefined);
  const fuelRecords=(context.fuels||[]).filter(f=>String(f.customerId)===String(rows[0].customerId)&&String(f.vehicleId)===String(v._id)&&new Date(f.periodFrom)<=new Date(rows[0].date)&&new Date(f.periodTo)>=new Date(rows.at(-1).date));
  const fuel=fuelRecords.length===1?fuelRecords[0]:undefined,mileage=agreement?.mileage??fuel?.mileage,fuelRate=agreement?.fuelRate??fuel?.fuelRate;
  const charge=prefix=>context.invoice?.lineItems?.filter(l=>l.vehicleNumber===v.vehicleNumber&&l.description.startsWith(prefix)).reduce((s,l)=>s+Number(l.amount),0);
  const fuelAmount=charge('Fuel reimbursement')??(km===0?0:mileage>0&&fuelRate!=null?Math.round(km/mileage*fuelRate*100)/100:undefined);
  const amc=charge('AMC')??Math.round(km*Number(v.amcRate||0)*100)/100,parking=charge('Monthly')??Number(v.parkingMonthly||0)+Number(v.tollEntryMonthly||0);
  const variableTotal=fuelAmount==null?'Fuel rate / mileage not set':Math.round((fuelAmount+adcTotal+airportTotal+amc+parking)*100)/100;
  const extraShifts=brandedAdc(rows,v.includedHours??(days-(off.length||Math.floor(days/7)))*v.shiftHours,off).additionalServices;
  const airportEntries=rows.filter(l=>l.airportFee>0),airportRates=new Set(airportEntries.map(l=>l.airportFee));
  const data=[
   ['Vendor name',context.company?.name||'LUCKY TRANSPORT SERVICES','','','','Fixed','No. of days','KM','Rate','Amount'],
   ['Vehicle type',type,'','','','Monthly fixed',days,fixedKm??'Not set',fixedRate??'Not set',fixedKm!=null&&fixedRate!=null?Math.round(fixedKm*fixedRate*100)/100:'Not set'],
   ['Vehicle no.',v.vehicleNumber,'','','','Variable','Mileage','Details / quantity','Rate','Amount'],
   ['Month',month,'','','','Fuel cost',mileage??'Not set',km,fuelRate??'Not set',fuelAmount??'Not set'],
   ['Assigned duty',v.shiftHours+' hours','','','','Additional service charges',Number((extraShifts/3).toFixed(2)),Number(extraShifts.toFixed(4)),v.adcRate||0,adcTotal],
   ['Weekly offs',off.length||Math.floor(days/7),'','','','Domestic airport entry','',airportEntries.length,airportRates.size===1?airportEntries[0].airportFee:airportRates.size?'Mixed':0,airportTotal],
   ['','','','','','Toll, entry & parking','','1','',parking],
   ['','','','','','AMC charges','',km,v.amcRate||0,amc],
   ['','','','','','Total variable (before GST)','','','',variableTotal],
   ['LOG SHEET - '+type+' - '+v.vehicleNumber+' BRANDED'],
   ["Date","Vehicle no.","Opening KM","Closing KM","Total KM","Opening time","Closing time","Total hours","Additional service charges","Domestic airport entry"],
   ...rows.map(l=>[new Date(l.date).toISOString().slice(0,10),v.vehicleNumber,l.held?"Loaded / held: "+l.holdLocation:l.openingKm,l.held?l.holdLocation:l.closingKm,l.distanceKm,l.openingTime,l.closingTime,l.totalHours,adc.get(String(l._id))||0,l.airportFee||0]),
   ["TOTAL","","","",km,"","",hours,adcTotal,airportTotal]];
  const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=[14,18,25,23,12,15,15,14,20,20].map(wch=>({wch}));ws['!merges']=[{s:{r:9,c:0},e:{r:9,c:9}},...Array.from({length:6},(_,r)=>({s:{r,c:1},e:{r,c:4}}))];
  ws['!rows']=data.map((_,r)=>({hpt:r<9?30:r===10?38:24}));
  for(const key of Object.keys(ws)){if(key.startsWith('!'))continue;const row=XLSX.utils.decode_cell(key).r,col=XLSX.utils.decode_cell(key).c;ws[key].s={font:{name:'Arial',sz:10,bold:row<3||row===8||row===9||row===10||row===data.length-1},alignment:{vertical:'center',wrapText:true},...(row>=9?{border:Object.fromEntries(['top','bottom','left','right'].map(k=>[k,{style:'thin',color:{rgb:'333333'}}]))}:{}),...(row===10?{fill:{fgColor:{rgb:'E8EDF2'}}}:{})};if(typeof ws[key].v==='number'&&((row<9&&col===9)||(row>=11&&col>=8)))ws[key].z='#,##0.00';}
  XLSX.utils.book_append_sheet(wb,ws,(v.vehicleNumber+'-'+month+'-'+ ++sheetIndex).slice(0,31));
 }
 return XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
}
