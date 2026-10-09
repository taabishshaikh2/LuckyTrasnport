export function logAdcAmounts(logs,shiftHours,adcRate,offCount,includedHours){
 if(!logs.length)return new Map();
 const first=new Date(logs[0].date),days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 let remaining=includedHours??(days-(offCount??Math.floor(days/7)))*shiftHours;
 const amounts=new Map();
 for(const l of [...logs].sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.openingTime.localeCompare(b.openingTime))){
  const hours=Number(l.totalHours||0),extra=Math.max(0,hours-Math.max(0,remaining));remaining-=hours;
  amounts.set(String(l._id),Math.round(extra/8*adcRate*100)/100);
 }
 return amounts;
}
