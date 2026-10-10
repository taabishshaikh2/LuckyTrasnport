import React from "react";
import {useNavigate} from "react-router-dom";
export default function TripRow({id,label,onOpen,children}) {
  const navigate=useNavigate();
  const open=()=>onOpen ? onOpen() : navigate("/trips/"+id);
  return <tr className="clickable-trip-row" tabIndex={0} aria-label={"Open trip "+(label||id)} onClick={event=>{if(!event.target.closest("a,button,input,select,textarea"))open();}} onKeyDown={event=>{if(event.target===event.currentTarget && ["Enter"," "].includes(event.key)){event.preventDefault();open();}}}>{children}</tr>;
}