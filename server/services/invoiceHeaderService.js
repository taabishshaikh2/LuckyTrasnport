export function invoiceHeader(d,c,width=d.page.width-d.page.margins.left-d.page.margins.right){
 const x=d.page.margins.left,center=(value,font,size,spacing=0)=>{if(!value)return;d.font(font).fontSize(size).fillColor("black").text(String(value),x,d.y,{width,align:"center",characterSpacing:spacing});};
 center(c.name||"LUCKY TRANSPORT SERVICES","Times-Bold",22);
 center(c.tagline||"TRANSPORT CONTRACTORS & COMMISSION AGENT","Times-Bold",8,1.4);
 center(c.address?(/^(reg|registered)/i.test(c.address)?c.address:"Reg Off: "+c.address):"","Times-Roman",8);
 center([c.email?"Email: "+c.email:"",c.phone?"Tel / Mob: "+c.phone:""].filter(Boolean).join("  "),"Times-Roman",8);
 d.y+=4;const y=d.y;d.moveTo(x,y).lineTo(x+width,y).lineWidth(.6).strokeColor("black").stroke();d.y=y+7;
}
