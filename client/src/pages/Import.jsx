import React, { useState } from "react";
import { sites } from "../../../shared/sites.js";
import { useNavigate } from "react-router-dom";
import { api, message, download } from "../api/client";
import { Field, Calculation } from "../components/UI";
import { AssignmentFields, initialTrip } from "../features/TripForm";
export default function Import() {
  const nav = useNavigate(),
    [file, setFile] = useState(null),
    [batch, setBatch] = useState(null),
    [mapping, setMapping] = useState({}),
    [header, setHeader] = useState(initialTrip()),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sheetName, setSheetName] = useState(""),
    [durationFormat, setDurationFormat] = useState("hoursMinutes"),
    [result, setResult] = useState(null);
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
      const dates = r.rows
        .map((row) => row[r.mapping.date])
        .filter((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))
        .sort();
      if (dates.length)
        setHeader((h) => ({
          ...h,
          periodFrom: dates[0],
          periodTo: dates[dates.length - 1],
        }));
      setResult(null);
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
    return { header: p, mapping, durationFormat };
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
          reviewToken: preview.reviewToken,
        })
      ).data.data;
      setResult(r);
      setPreview(null);
      setBatch(null);
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
        Upload → map columns → validate → confirm. Each challan becomes one
        draft trip; repeated rows for one challan stay together. Vehicle numbers are matched automatically.
      </p>
      <Field name="site" label="Site / Excel format" options={sites} value={header.site} onChange={change} />
      <button
        className="quiet"
        onClick={async () => {
          try {
            await download(
              "/exports/import-template.xlsx?site=" + header.site,
              "trip-import-template.xlsx",
            );
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        Download import template
      </button>
      {result && (
        <section className="card">
          <h2>{result.trips.length} draft trips imported</h2>
          <p>
            {result.failedRows} invalid rows · {result.duplicateRows} duplicates
            skipped. No invoice created.
          </p>
          <button onClick={() => nav("/trips")}>View trips</button>
          <button
            className="quiet"
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "import-results.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download results
          </button>
        </section>
      )}
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
          label="Worksheet name (blank = first trip table)"
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
          <h2>2. Default assignment</h2>
          <Field
            name="durationFormat"
            label="How are duration cells stored?"
            options={[
              {
                value: "hoursMinutes",
                label: "Hours.minutes — 8.30 means 8h 30m",
              },
              { value: "decimal", label: "Decimal hours — 8.5 means 8h 30m" },
              {
                value: "excelTime",
                label: "Excel time cells / fractions of a day",
              },
            ]}
            value={durationFormat}
            onChange={(_, v) => {
              setDurationFormat(v);
              setPreview(null);
            }}
          />
          <div className="card form-grid">
            <AssignmentFields value={header} onChange={change} importing />
            <Field
              name="periodFrom"
              label="Import period from"
              type="date"
              value={header.periodFrom}
              onChange={change}
            />
            <Field
              name="periodTo"
              label="Import period to"
              type="date"
              value={header.periodTo}
              onChange={change}
            />
          </div>
          <p>
            Select the customer, route and optional default driver for this
            worksheet. Opening time must mean pickup arrival. Each row uses its
            own date, vehicle and duration. Toll/parking is added per row;
            monthly passes are not added here.
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
          <p>
            Total of new draft trips: ₹{preview.calculation.totalAmount} ·{" "}
            {preview.duplicateRows} duplicate rows skipped. Charges use
            configured rates and rounding; review warnings while business rules
            are being confirmed.
          </p>
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
              {r.calculation && <Calculation value={r.calculation} />}
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
          <button
            className="wide"
            disabled={busy || !preview.successfulRows}
            onClick={confirm}
          >
            Confirm import of {preview.successfulRows} valid / warning rows
          </button>
        </>
      )}
    </>
  );
}
