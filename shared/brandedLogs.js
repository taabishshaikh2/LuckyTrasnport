export function billingShift(logs,override,fallback){
 if(override!=null){if(![8,16,24].includes(Number(override)))throw Error("Choose an 8, 16 or 24-hour billing shift");return Number(override);}
 if(!logs.length)return fallback;
 const shifts=new Set(logs.map(l=>Number(l.shiftHours)));
 if(shifts.size!==1 || ![8,16,24].includes([...shifts][0]))throw Error("Logs have missing or different saved shifts. Choose a billing shift explicitly for this period");
 return [...shifts][0];
}
const day=value=>new Date(value?.date??value).toISOString().slice(0,10);
export function brandedAdc(logs,includedHours,offDates=[]){
 const dates=new Set(offDates.map(day)),minutes=new Map();let remaining=Math.max(0,Math.round(includedHours*60)),offDutyMinutes=0,regularExtraMinutes=0;
 for(const log of [...logs].sort((a,b)=>+new Date(a.date)-+new Date(b.date)||a.openingTime.localeCompare(b.openingTime))){
  const worked=Math.round(Number(log.totalHours||0)*60);let extra;
  if(dates.has(day(log.date))){extra=worked;offDutyMinutes+=worked;}
  else{extra=Math.max(0,worked-remaining);remaining=Math.max(0,remaining-worked);regularExtraMinutes+=extra;}
  minutes.set(String(log._id),extra);
 }
 const extraMinutes=offDutyMinutes+regularExtraMinutes;
 return {minutes,offDutyMinutes,regularExtraMinutes,extraMinutes,additionalServices:extraMinutes/480};
}
export function logAdcAmounts(logs,shiftHours,adcRate,offCount,includedHours,offDates=[]){
 if(!logs.length)return new Map();
 const first=new Date(logs[0].date),days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 let savedShift;try{savedShift=billingShift(logs);}catch{if(includedHours==null)return new Map();}
 const included=includedHours??(days-(offCount??Math.floor(days/7)))*savedShift;
 return new Map([...brandedAdc(logs,included,offDates).minutes].map(([id,minutes])=>[id,Math.round(minutes/480*adcRate*100)/100]));
}
