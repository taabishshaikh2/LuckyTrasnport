import {sites} from "./sites.js";
export function routeSite(route){
 if(route.site)return route.site;
 if(["Inbound","Outbound"].includes(route.category))return route.category;
 if(route.category==="Special")return route.routeName;
 const text=(route.routeName+" "+route.pickupLocation).toLowerCase();
 const aliases={Goregaon:/goregaon|goregoan|ggt1/,VVR:/vidhy|vidya|vidhya|vvr/,Byculla:/byculla/,PNQ:/pnq|pune/};
 return Object.keys(aliases).find(k=>aliases[k].test(text))||route.routeName;
}
export function siteOptions(routes=[],trips=[]){
 const result=new Map();for(const route of routes.filter(r=>r.active&&!r.archived)){const value=routeSite(route);result.set(value,{value,label:route.routeName,origin:route.pickupLocation,destination:route.dropLocation,routeId:route._id,group:["Inbound","Outbound"].includes(value)?"Intercity":"Special"});}
 for(const trip of trips)if(trip.site&&!result.has(trip.site))result.set(trip.site,{...(sites.find(s=>s.value===trip.site)||{value:trip.site,label:trip.site}),group:["Inbound","Outbound"].includes(trip.site)?"Intercity":"Special"});
 return [...result.values()];
}

export const locationGroup=route=>["Inbound","Outbound"].includes(routeSite(route))?"Intercity":"Special";
