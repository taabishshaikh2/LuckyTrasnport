import React,{useLayoutEffect,useRef,useState} from "react";
export default function TripScroll({children}){
 const top=useRef(null),bottom=useRef(null),[width,setWidth]=useState(0),[overflow,setOverflow]=useState(false);
 useLayoutEffect(()=>{
  const box=bottom.current,table=box?.querySelector("table");
  const measure=()=>{setWidth(box.scrollWidth);setOverflow(box.scrollWidth>box.clientWidth);if(top.current)top.current.scrollLeft=box.scrollLeft;};
  measure();const observer=new ResizeObserver(measure);observer.observe(box);if(table)observer.observe(table);return ()=>observer.disconnect();
 },[children]);
 return <><div ref={top} className="sheet-scroll trip-top-scroll" aria-label="Scroll trip table horizontally" tabIndex={overflow?0:-1} style={{overflowX:"auto",display:overflow?"block":"none"}} onScroll={e=>{if(bottom.current)bottom.current.scrollLeft=e.currentTarget.scrollLeft;}}><div style={{width,height:1}}/></div><div ref={bottom} className="sheet-scroll" onScroll={e=>{if(top.current)top.current.scrollLeft=e.currentTarget.scrollLeft;}}>{children}</div></>;
}
