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
import TripForm from "../features/TripForm";
export function TripList({ user }) {
  const records = useData("/trips"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Trips & challans</h1>
        </div>
        {user.role !== "DRIVER" && (
          <Link className="button" to="/trips/new">
            + New trip
          </Link>
        )}
      </div>
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
      <State {...records}>
        <div className="card-grid">
          {records.data
            ?.filter(
              (t) =>
                JSON.stringify(t)
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (!status || t.status === status) &&
                (!from || t.periodFrom.slice(0, 10) >= from) &&
                (!to || t.periodFrom.slice(0, 10) <= to),
            )
            .map((t) => (
              <Link className="card record" key={t._id} to={"/trips/" + t._id}>
                <div className="row">
                  <span className="record-id">{t.tripId}</span>
                  <Badge>{t.status}</Badge>
                </div>
                <h3>
                  {t.pickupLocation} → {t.dropLocation}
                </h3>
                <p>
                  {t.customerId?.companyName} · {t.vehicleNumber}
                </p>
                <div className="row">
                  <span>{date(t.periodFrom)}</span>
                  <strong>{currency(t.totalAmount)}</strong>
                </div>
              </Link>
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
        driverId: t.driverId._id,
        routeId: t.routeId._id,
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
                {date(t.periodFrom)} – {date(t.periodTo)} · {t.distanceKm} KM ·{" "}
                {t.totalHours} hours
              </p>
              <p>
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
            <Calculation value={t.calculation} />
            {user.role !== "DRIVER" && (
              <div className="actions">
                {t.status === "Draft" && (
                  <>
                    <button onClick={() => setEdit(true)}>Edit draft</button>
                    <button
                      onClick={() =>
                        setEntries(
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
                    {i + 1}. {date(e.date)} · {e.chaName || "Challan"}
                  </strong>
                  <p>
                    {e.vehicleNo || t.vehicleNumber} · {e.openingTime || "—"} →{" "}
                    {e.closingTime || "—"} · {e.totalHours} hours ·{" "}
                    {e.distanceKm} KM
                  </p>
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
                      {[
                        ["date", "Date", "date"],
                        ["vehicleNo", "Vehicle", "text"],
                        ["chaName", "CHA name", "text"],
                        ["openingTime", "Opening time", "time"],
                        ["mrbArrivalTime", "MRB arrival", "time"],
                        ["closingTime", "Closing time", "time"],
                        ["perTripHours", "Trip hours", "number"],
                        ["totalHours", "Total hours", "number"],
                        ["gtInHours", "G.T hours", "number"],
                        ["gtAmount", "G.T amount", "number"],
                        ["distanceKm", "KM", "number"],
                        ["remarks", "Remarks", "text"],
                      ].map(([name, label, type]) => (
                        <Field
                          key={name}
                          name={name}
                          label={label}
                          type={type}
                          value={e[name]}
                          onChange={(k, v) => changeEntry(i, k, v)}
                        />
                      ))}
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
