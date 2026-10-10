import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useData } from "../hooks/useData";
import { api, message, download } from "../api/client";
import {
  State,
  Badge,
  currency,
  date,
  Calculation,
  Field,
  today,
} from "../components/UI";
import { SheetFields, SheetSummary } from "../features/SheetFields";
import LegacyTripForm from "../features/TripForm";
import AdhocTripForm from "../features/AdhocTripForm";
const TripForm=props=>props.existing?.adhocService?<AdhocTripForm {...props}/>:<LegacyTripForm {...props}/>;
import TripTable from "../features/TripTable";
import { durationText } from "../../../shared/sites.js";
import { sites } from "../../../shared/sites.js";
export function TripList({ user }) {
  const {site:routeSite}=useParams(),[query,setQuery]=useSearchParams();
  const site=routeSite || "",all=useData("/trips"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(query.get("month") || "")?query.get("month"):today().slice(0,7);
  const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const from=query.get("from") || month+"-01",to=query.get("to") || lastDay,status=query.get("status") || "";
  const archived=query.get("archived")==="true";
  const valid=from<=to;
  const filters=new URLSearchParams({site,from,to,status,archived:String(archived)});
  const records=useData("/trips?"+filters),passes=useData("/masters/accPasses");
  const update=(key,value)=>{const next=new URLSearchParams(query);next.set(key,value);if(key==="month"){next.delete("from");next.delete("to");}setQuery(next);};
  const options=[...sites,...[...new Set((all.data||[]).map(t=>t.site).filter(Boolean))].filter(value=>!sites.some(s=>s.value===value)).map(value=>({value,label:value}))];
  if(!site)return <><div className="page-head"><div><p className="eyebrow">OPERATIONS</p><h1>Trips by site</h1></div>{user.role!=="DRIVER"&&<Link className="button" to="/trips/new">+ Adhoc trip</Link>}</div><p>Choose a site to view its trips and export a selected month or date range.</p><State {...all}><div className="card-grid">{options.map(s=><Link className="card record" key={s.value} to={"/trips/site/"+encodeURIComponent(s.value)}><h2>{s.label}</h2><p>{(all.data||[]).filter(t=>t.site===s.value).length} trips</p><span>View trips →</span></Link>)}</div></State></>;
  const label=options.find(s=>s.value===site)?.label || site;
  return <><Link to="/trips">← All sites</Link><div className="page-head"><div><p className="eyebrow">SITE TRIPS</p><h1>{label}</h1></div>{user.role!=="DRIVER"&&<Link className="button" to={"/trips/new?site="+encodeURIComponent(site)}>+ Add trip</Link>}</div>
    <div className="form-grid card"><Field name="month" label="Month" type="month" value={month} onChange={update}/><Field name="from" label="From date" type="date" value={from} onChange={update}/><Field name="to" label="To date" type="date" value={to} onChange={update}/><Field name="status" label="Status" value={status} options={[{value:"",label:"All statuses"},... ["Draft","Submitted","Approved","Completed","Invoiced","Cancelled"].map(value=>({value,label:value}))]} onChange={update}/></div>
    {!valid&&<p className="error">To date must be on or after From date.</p>}{error&&<p className="error">{error}</p>}
    <div className="actions">{user.role!=="DRIVER"&&<><button disabled={!valid||archived||records.loading||!!records.error||!records.data?.length||busy} onClick={async()=>{setBusy(true);setError("");try{await download("/exports/trips.xlsx?"+new URLSearchParams({site,from,to,status}),site+"-"+from+"-to-"+to+".xlsx");}catch(e){setError(message(e));}finally{setBusy(false);}}}>{busy?"Exporting…":"Export "+site+" Excel"}</button><label><input type="checkbox" checked={archived} onChange={e=>update("archived",String(e.target.checked))}/> Show archived trips</label></>}</div>
    {valid&&<State {...records}>{records.data?.length?<><p className="muted">{records.data.length} trips · {date(from)} to {date(to)}</p><TripTable trips={records.data} passes={passes.data||[]}/>{passes.error&&<p className="error">ACC passes could not be loaded. Refresh before reviewing totals.</p>}{archived&&user.role!=="DRIVER"&&<div className="card-grid">{records.data.map(t=><section className="card" key={t._id}><strong>{t.tripId}</strong><button className="quiet" onClick={async()=>{try{await api.post("/trips/"+t._id+"/archive",{archived:false});records.reload();all.reload();}catch(e){setError(message(e));}}}>Restore trip</button></section>)}</div>}</>:<p className="state">No {site} trips in this date range.</p>}</State>}
  </>;
}
export function TripDetail({ user }) {
  const { id } = useParams(),
    record = useData("/trips/" + id),
    [edit, setEdit] = useState(false),
    [entries, setEntries] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const t = record.data;
  const changeEntry = (i, k, v) =>
    setEntries((rows) => rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  async function action(status) {
    setBusy(true);
    setError("");
    try {
      await api.post("/trips/" + id + "/status", { status, reason });
      record.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(ext) {
    try {
      await download(
        ext === "xlsx"
          ? "/exports/trips.xlsx?tripId=" + id
          : "/exports/trips/" + id + ".docx",
        t.tripId + "." + ext,
      );
    } catch (e) {
      setError("Download failed. " + message(e));
    }
  }
  async function saveEntries() {
    setBusy(true);
    try {
      const input = {
        ...t,
        customerId: t.customerId._id,
        vehicleId: t.vehicleId._id,
        driverId: t.driverId?._id || "",
        routeId: t.routeId?._id || "",
        periodFrom: t.periodFrom.slice(0, 10),
        periodTo: t.periodTo.slice(0, 10),
        entries,
      };
      const p = (await api.post("/trips/preview", input)).data.data;
      await api.patch("/trips/" + id, {
        ...input,
        expectedTotal: p.calculation.totalAmount,
      });
      setEntries(null);
      record.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <State {...record}>
      {t &&
        (edit ? (
          <TripForm
            existing={t}
            onClose={() => {
              setEdit(false);
              record.reload();
            }}
          />
        ) : (
          <>
            <div className="page-head">
              <div>
                {t.site && <Link to={"/trips/site/"+encodeURIComponent(t.site)+"?month="+t.periodFrom.slice(0,7)}>← {t.site} trips</Link>}
                <p className="eyebrow">TRIP DETAILS</p>
                <h1>{t.tripId}</h1>
              </div>
              <Badge>{t.status}</Badge>
            </div>
            {error && <p className="error">{error}</p>}
            <section className="card">
              <h2>
                {t.pickupLocation} → {t.dropLocation}
              </h2>
              <p>
                {t.customerId?.companyName} · {t.vehicleNumber} ·{" "}
                {t.driverId?.fullName}
              </p>
              <p>
                {date(t.periodFrom)} – {date(t.periodTo)}{!["Inbound","Outbound"].includes(t.site) && <> · {t.distanceKm} KM</>} ·{" "}
                {Number(t.totalHours || 0).toFixed(2)} hours
              </p>
              <p hidden={!!t.adhocService}>
                Source: {t.source} · Operationally{" "}
                {t.operationalCompleted ? "completed" : "open"}
              </p>
              {t.override && (
                <p className="notice">
                  Rate override: {currency(t.override.originalCalculatedRate)} →{" "}
                  {currency(t.override.finalRate)}. Reason:{" "}
                  {t.override.overrideReason}
                </p>
              )}
            </section>
            <Calculation value={t.calculation} site={t.site} distanceBand={t.distanceBand} compact={!!t.adhocService} />
            {user.role !== "DRIVER" && (
              <div className="actions">
                {!t.archived && ["Draft","Cancelled"].includes(t.status) && <button className="danger" disabled={busy} onClick={async()=>{setBusy(true);try{await api.post("/trips/"+id+"/archive",{archived:true});record.reload();}catch(e){setError(message(e));}finally{setBusy(false);}}}>Archive trip</button>}
                {t.archived && <p className="notice">Archived. Restore this trip from the archived trips list.</p>}
                {!t.archived && t.status === "Draft" && (
                  <>
                    <button onClick={() => setEdit(true)}>Edit draft</button>
                    <button
                      onClick={() =>
                        t.adhocService ? setEdit(true) : setEntries(
                          t.entries.map((e) => ({
                            ...e,
                            date: e.date.slice(0, 10),
                          })),
                        )
                      }
                    >
                      Edit challan entries
                    </button>
                    <button disabled={busy} onClick={() => action("Submitted")}>
                      Submit
                    </button>
                  </>
                )}
                {t.status === "Submitted" && (
                  <button disabled={busy} onClick={() => action("Approved")}>
                    Approve trip
                  </button>
                )}
                {(t.status === "Approved" ||
                  (t.status === "Invoiced" && !t.operationalCompleted)) && (
                  <button disabled={busy} onClick={() => action("Completed")}>
                    Complete duty
                  </button>
                )}
                <button className="quiet" onClick={() => exportFile("xlsx")}>
                  Excel
                </button>
                <button className="quiet" onClick={() => exportFile("docx")}>
                  DOCX trip sheet
                </button>
                {!["Cancelled", "Invoiced"].includes(t.status) && (
                  <>
                    <input
                      aria-label="Cancellation reason"
                      placeholder="Cancellation reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="danger"
                      disabled={busy || !reason.trim()}
                      onClick={() => action("Cancelled")}
                    >
                      Cancel trip
                    </button>
                  </>
                )}
              </div>
            )}
            <h2>Challan entries</h2>
            {t.entries.length === 0 ? (
              <div className="state">No challan entries recorded.</div>
            ) : (
              t.entries.map((e, i) => (
                <section className="card" key={i}>
                  <strong>
                    {i + 1}. {date(e.date)} · {t.site === "Inbound" ? e.chaName || "Inbound trip" : e.huNumber ? "HUID " + e.huNumber : "Trip"}
                  </strong>
                  <p>
                    {e.vehicleNo || t.vehicleNumber} · {e.openingTime || "—"} →{" "}
                    {e.closingTime || "—"} · {durationText(e.totalHours)} hours
                    {!["Inbound","Outbound"].includes(t.site) && <> · {e.distanceKm} KM</>}
                  </p>
                  <SheetSummary entry={e} trip={t} index={i} />
                </section>
              ))
            )}
            <h2>Audit history</h2>
            {t.audit?.map((a) => (
              <p className="muted" key={a._id}>
                {date(a.createdAt)} · {a.reason}
              </p>
            ))}
            {entries && (
              <div className="modal-backdrop">
                <section className="modal">
                  <h2>Edit challan entries</h2>
                  <p>
                    Header duty and distance remain authoritative; revise them
                    in Edit draft when changing charge totals.
                  </p>
                  {entries.map((e, i) => (
                    <div className="card form-grid" key={i}>
                      <Field
                        name="date"
                        label="Date"
                        type="date"
                        value={e.date}
                        onChange={(k, v) => changeEntry(i, k, v)}
                      />
                      <Field
                        name="vehicleNo"
                        label="Vehicle number"
                        value={e.vehicleNo}
                        onChange={(k, v) => changeEntry(i, k, v)}
                      />
                      <SheetFields
                        entry={e}
                        onChange={(k, v) => changeEntry(i, k, v)}
                      />
                      <button
                        className="danger"
                        onClick={() =>
                          setEntries((r) => r.filter((_, n) => n !== i))
                        }
                      >
                        Remove entry
                      </button>
                    </div>
                  ))}
                  {error && <p className="error">{error}</p>}
                  <div className="actions">
                    <button
                      onClick={() =>
                        setEntries((r) => [
                          ...r,
                          {
                            date: t.periodFrom.slice(0, 10),
                            vehicleNo: t.vehicleNumber,
                            totalHours: 0,
                            distanceKm: 0,
                          },
                        ])
                      }
                    >
                      + Entry
                    </button>
                    <button disabled={busy} onClick={saveEntries}>
                      Save entries
                    </button>
                    <button className="quiet" onClick={() => setEntries(null)}>
                      Close
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        ))}
    </State>
  );
}
