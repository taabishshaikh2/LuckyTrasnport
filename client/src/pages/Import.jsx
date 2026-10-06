import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, message } from "../api/client";
import { Field, Calculation } from "../components/UI";
import {
  AssignmentFields,
  DutyFields,
  initialTrip,
} from "../features/TripForm";
export default function Import() {
  const nav = useNavigate(),
    [file, setFile] = useState(null),
    [batch, setBatch] = useState(null),
    [mapping, setMapping] = useState({}),
    [header, setHeader] = useState(initialTrip()),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sheetName, setSheetName] = useState("");
  function change(k, v) {
    setHeader((x) => ({ ...x, [k]: v }));
    setPreview(null);
  }
  async function upload(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (sheetName) form.append("sheetName", sheetName);
      const r = (await api.post("/imports/upload", form)).data.data;
      setBatch(r);
      setMapping(r.mapping);
      setPreview(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const payload = () => {
    const p = { ...header };
    for (const k of ["manualAmount", "overrideAmount"])
      if (p[k] === "" || p[k] == null) delete p[k];
    return { header: p, mapping };
  };
  async function review() {
    setBusy(true);
    setError("");
    try {
      setPreview(
        (await api.post("/imports/" + batch.batchId + "/preview", payload()))
          .data.data,
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const r = (
        await api.post("/imports/" + batch.batchId + "/confirm", {
          ...payload(),
          confirm: true,
          expectedTotal: preview.calculation.totalAmount,
        })
      ).data.data;
      nav("/trips/" + r.trip._id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">IMPORT WORKFLOW</p>
      <h1>Import Excel challans</h1>
      <p className="muted">
        Upload → map columns → validate → confirm. One worksheet becomes one
        trip; choose a matching vehicle and billing period.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="card" onSubmit={upload}>
        <label className="field">
          <span>Workbook (.xlsx / .xls, max 5 MB)</span>
          <input
            required
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
        <Field
          name="sheetName"
          label="Worksheet name (blank = first sheet)"
          value={sheetName}
          onChange={(_, v) => setSheetName(v)}
        />
        <button disabled={busy || !file}>Read workbook</button>
      </form>
      {batch && (
        <>
          <h2>1. Map columns</h2>
          <p>
            {batch.rows.length} rows · Worksheets: {batch.sheetNames.join(", ")}
          </p>
          <div className="card form-grid">
            {batch.fields.map((f) => (
              <Field
                key={f}
                name={f}
                label={f}
                options={batch.headers}
                value={mapping[f]}
                onChange={(k, v) => {
                  setMapping((m) => ({ ...m, [k]: v }));
                  setPreview(null);
                }}
              />
            ))}
          </div>
          <h2>2. Trip assignment & charge basis</h2>
          <div className="card form-grid">
            <AssignmentFields value={header} onChange={change} />
            <DutyFields value={header} onChange={change} />
          </div>
          <p>
            Imported row distance and total duty hours are summed. Header
            adjustments apply once to the complete trip.
          </p>
          <button disabled={busy} onClick={review}>
            Validate & preview
          </button>
        </>
      )}
      {preview && (
        <>
          <h2>3. Review import</h2>
          <p className="notice">
            {preview.successfulRows} accepted rows · {preview.failedRows}{" "}
            invalid rows excluded ·{" "}
            {preview.rows.filter((r) => r.status === "Warning").length} rows
            with warnings
          </p>
          <Calculation value={preview.calculation} />
          {preview.rows.map((r) => (
            <section className="card" key={r.rowNumber}>
              <div className="row">
                <strong>
                  Row {r.rowNumber} · {r.data.date}
                </strong>
                <span>{r.status}</span>
              </div>
              <p>
                {r.data.vehicleNo} · {r.data.chaName} · {r.data.totalHours}{" "}
                hours · {r.data.distanceKm} KM
              </p>
              {r.errors.map((e) => (
                <p key={e} className="error">
                  {e}
                </p>
              ))}
              {r.warnings.map((w) => (
                <p className="notice" key={w}>
                  {w}
                </p>
              ))}
            </section>
          ))}
          <button className="wide" disabled={busy} onClick={confirm}>
            Confirm import of {preview.successfulRows} valid / warning rows
          </button>
        </>
      )}
    </>
  );
}
