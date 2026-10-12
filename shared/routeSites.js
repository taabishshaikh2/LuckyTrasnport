import {sites} from "./sites.js";
export function routeSite(route){
 if(route.site)return route.site;
 if(["Inbound","Outbound","Special"].includes(route.category))return route.category;
 const text=(route.routeName+" "+route.pickupLocation).toLowerCase();
 const aliases={Goregaon:/goregaon|goregoan|ggt1/,VVR:/vidhy|vidya|vidhya|vvr/,Byculla:/byculla/,PNQ:/pnq|pune/};
 return Object.keys(aliases).find(k=>aliases[k].test(text))||route.routeName;
}
export function siteOptions(routes=[],trips=[]){
 const result=new Map();for(const route of routes.filter(r=>r.active&&!r.archived)){const value=routeSite(route);result.set(value,{value,label:sites.find(s=>s.value===value)?.label||route.routeName,origin:route.pickupLocation,destination:route.dropLocation});}
 for(const trip of trips)if(trip.site&&!result.has(trip.site))result.set(trip.site,sites.find(s=>s.value===trip.site)||{value:trip.site,label:trip.site});
 return [...result.values()];
}
