import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const [showArchived,setShowArchived]=useState(false);
  const records = useData("/trips?archived="+showArchived),
    [site,setSite]=useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [exportError, setExportError] = useState(""),
    [exporting, setExporting] = useState(false);
  const exportableTrips = (records.data || []).filter(
    (t) =>
      (!site || t.site === site) &&
      (!status || t.status === status) &&
      (!from || t.periodFrom.slice(0, 10) >= from) &&
      (!to || t.periodFrom.slice(0, 10) <= to),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Trips & challans</h1>
        </div>
        {user.role !== "DRIVER" && (
          <><Link className="button" to="/brandedLogs?new">+ Branded shift</Link>
          <Link className="button" to="/trips/new">
            + Adhoc trip
          </Link></>
        )}
      </div>
      <Field name="site" label="Site" options={[{value:"",label:"All sites"},...sites]} value={site} onChange={(_,v)=>setSite(v)} />
      {user.role !== "DRIVER" && <label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived trips</label>}
      <div className="filters">
        <input
          placeholder="Search ID, customer, vehicle, route or driver…"
          aria-label="Search trips"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Trip status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "Draft",
            "Submitted",
            "Approved",
            "Completed",
            "Invoiced",
            "Cancelled",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          aria-label="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {user.role !== "DRIVER" && (
        <div className="actions">
          <Link className="button quiet" to="/import">
            Bulk import
          </Link>
          <button
            className="quiet"
            disabled={
              showArchived || records.loading ||
              !!records.error ||
              exporting ||
              !exportableTrips.length
            }
            title={
              !exportableTrips.length
                ? "No trips match the date / status filters"
                : "Download matching trips"
            }
            onClick={async () => {
              setExporting(true);
              setExportError("");
              try {
                const q = new URLSearchParams({ from, to, status, site });
                await download("/exports/trips.xlsx?" + q, "trips.xlsx");
              } catch (e) {
                setExportError(message(e));
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "Exporting…" : "Export Excel (date / status filters)"}
          </button>
        </div>
      )}
      {exportError && <p className="error">{exportError}</p>}
      <State {...records}>
        <TripTable trips={exportableTrips.filter(t=>JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))} />
        <div className="card-grid">
          {records.data
            ?.filter(
              (t) =>
                JSON.stringify(t)
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (!site || t.site === site) &&
      (!status || t.status === status) &&
                (!from || t.periodFrom.slice(0, 10) >= from) &&
                (!to || t.periodFrom.slice(0, 10) <= to),
            )
            .map((t) => (
              <article className="card record" key={t._id}>
                <div className="row">
                  <Link className="record-id" to={"/trips/" + t._id}>
                    {t.tripId}
                  </Link>
                  <Badge>{t.status}</Badge>
                </div>
                {showArchived && user.role !== "DRIVER" && <button className="quiet" onClick={async()=>{try{await api.post("/trips/"+t._id+"/archive",{archived:false});records.reload();}catch(e){setExportError(message(e));}}}>Restore trip</button>}
                <h3>
                  {t.pickupLocation} → {t.dropLocation}
                </h3>
                <p>
                  {t.customerId?.companyName} · {t.vehicleNumber}
                </p>
                {t.entries?.[0] && (
                  <details onClick={(e) => e.stopPropagation()}>
                    <summary>Trip-sheet columns</summary>
                    <SheetSummary entry={t.entries[0]} trip={t} />
                  </details>
                )}
                <div className="row">
                  <span>{date(t.periodFrom)}</span>
                  <strong>{currency(t.totalAmount)}</strong>
                </div>
              </article>
            ))}
        </div>
        {records.data?.length === 0 && (
          <div className="state">No trips yet. Create your first trip.</div>
        )}
      </State>
    </>
  );
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
