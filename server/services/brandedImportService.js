import XLSX from "xlsx";
import {masterSchemas} from "../validators/index.js";
export const brandedHeaders=['Date','Vehicle no.','Opening KM','Closing KM','Total KM','Opening time','Closing time','Total hours','Additional service charges','Domestic airport entry'];
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
function day(v){if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(!d)throw Error('Invalid date');return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}const s=String(v||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;throw Error('Use DD-MM-YYYY or YYYY-MM-DD for dates');}
function clock(v){if(v instanceof Date)return v.toISOString().slice(11,16);let h,m;if(typeof v==='number'&&v<1){const minutes=Math.round(v*1440);h=Math.floor(minutes/60);m=minutes%60;}else{const parts=String(v??'').trim().match(/^(\d{1,2})(?:[:.](\d{1,2}))?(?::\d{2})?$/);if(!parts)throw Error('Use 24-hour times, for example 07:00');h=Number(parts[1]);m=Number(parts[2]||0);if(typeof v==='number'&&parts[2]?.length===1)m*=10;}return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
export function parseBrandedWorkbook(buffer,customerId,vehicles){
 const wb=XLSX.read(buffer,{type:'buffer'}),rows=[],errors=[];
 for(const sheetName of wb.SheetNames){const sheet=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});let header=-1,index;
  for(let n=0;n<sheet.length;n++){const names=sheet[n].map(norm);if(names.includes('date')&&names.includes('openingtime')&&names.includes('closingtime')){header=n;index=brandedHeaders.map(h=>names.indexOf(norm(h)));if(index[9]<0)index[9]=names.findIndex(n=>n.startsWith("domesticairport")||n==="airportentryfee");break;}}
  if(header<0)continue;
  let previousDate="";
  for(let n=header+1;n<sheet.length;n++){const row=sheet[n],get=k=>row[index[k]]??'';if(norm(get(0))==='total'||norm(get(0))==='date'||(!get(1)&&!get(5)&&!get(6)))continue;
   if(get(0))previousDate=get(0);if(!previousDate){errors.push({sheet:sheetName,row:n+1,message:'Missing date'});continue;}
   try{const vehicleNumber=String(get(1)).toUpperCase().replace(/[^A-Z0-9]/g,'');const vehicle=vehicles.find(v=>v.vehicleNumber===vehicleNumber);if(!vehicle)throw Error('Vehicle '+vehicleNumber+' is not an available branded vehicle');
    const held=[get(2),get(3)].some(v=>typeof v==='string'&&v.trim()&&!/^\d+(?:\.\d+)?$/.test(v.trim()));
    let openingTime=clock(get(5)),closingTime=clock(get(6));
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));if((minutes(closingTime)-minutes(openingTime)+1440)%1440===1200)closingTime=String((Number(closingTime.slice(0,2))+12)%24).padStart(2,'0')+closingTime.slice(2);
    const parsed=masterSchemas.brandedLogs.parse({customerId,vehicleId:String(vehicle._id),date:day(previousDate),openingKm:held?0:Number(get(2)),closingKm:held?0:Number(get(3)),openingTime,closingTime,held,holdLocation:held?[get(2),get(3)].filter(v=>typeof v==='string').join(' / '):'',airportFee:Number(get(9)||0)});
    rows.push({sheet:sheetName,row:n+1,vehicleNumber,...parsed});
   }catch(e){errors.push({sheet:sheetName,row:n+1,message:e.issues?.map(i=>i.message).join('; ')||e.message});}
  }
 }
 if(!rows.length&&!errors.length)throw Error('No branded log rows found. Use the branded template or exported log workbook');
 if(rows.length>1000)throw Error('Import at most 1,000 shifts per file');
 return {rows,errors};
}
