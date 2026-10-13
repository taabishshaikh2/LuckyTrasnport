import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, download, message } from "../api/client";
import { useData } from "../hooks/useData";
import { Field, State, currency } from "../components/UI";
import TripScroll from "../features/TripScroll";
import { gstColumns, gstMoneyKeys } from "../../../shared/gst.js";
export default function Gst() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const query = new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    records = useData("/gst?" + query),
    valid = !from || !to || from <= to;
  async function exportFile(sample) {
    setError("");
    try {
      await download(
        sample ? "/gst/sample.xlsx" : "/gst/export.xlsx?" + query,
        sample ? "GST-sample.xlsx" : "GST-records.xlsx",
      );
    } catch (e) {
      setError(message(e));
    }
  }
  async function importFile(confirm = false) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("confirm", String(confirm));
      const result = (await api.post("/gst/import", body)).data.data;
      if (confirm) {
        setPreview(null);
        setNotice(
          `${result.count} GST records imported; ${result.skipped} existing bills skipped.`,
        );
        records.reload();
      } else setPreview(result);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const rows = valid ? records.data || [] : [],
    total = (key) => rows.reduce((sum, r) => sum + Number(r[key] || 0), 0);
  return (
    <>
      <div className="page-head">
        <h1>GST records</h1>
      </div>
      <p>
        Invoices appear automatically. Cancelled invoices are excluded. Total
        amount is before GST; Toll includes saved non-taxable toll, parking and
        pass charges.
      </p>
      <div className="card form-grid">
        <Field
          name="from"
          label="From bill date"
          type="date"
          value={from}
          onChange={(_, v) => setFrom(v)}
        />
        <Field
          name="to"
          label="To bill date"
          type="date"
          value={to}
          onChange={(_, v) => setTo(v)}
        />
      </div>
      <div className="actions">
        <button
          disabled={!valid || records.loading || !!records.error}
          onClick={() => exportFile(false)}
        >
          Export Excel
        </button>
        <button className="quiet" onClick={() => exportFile(true)}>
          Download sample Excel
        </button>
      </div>
      <section className="card">
        <h2>Import GST records</h2>
        <p>
          Import historical bills using the sample columns. Existing bill
          numbers are skipped. This does not create or change invoices.
        </p>
        <label className="field">
          <span>Excel file</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files[0] || null);
              setPreview(null);
              setNotice("");
            }}
          />
        </label>
        <button disabled={!file || busy} onClick={() => importFile(false)}>
          {busy ? "Please wait..." : "Review import"}
        </button>
        {preview && (
          <>
            <p>
              {preview.rows.length} new records; {preview.skipped} existing
              bills skipped.
            </p>
            {preview.errors.length > 0 && (
              <ul className="error">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {e.sheet}, row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {preview.rows.length > 0 && (
              <TripScroll>
                <table className="sheet-table">
                  <thead>
                    <tr>
                      <th>Bill no</th>
                      <th>Customer</th>
                      <th>Bill date</th>
                      <th>Total before GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.billNumber}>
                        <td>{r.billNumber}</td>
                        <td>{r.customerName}</td>
                        <td>{r.billDate}</td>
                        <td>{currency(r.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TripScroll>
            )}
            <button
              disabled={
                busy || preview.errors.length > 0 || !preview.rows.length
              }
              onClick={() => importFile(true)}
            >
              Import {preview.rows.length} records
            </button>
          </>
        )}
      </section>
      {!valid && (
        <p className="error">To date must be on or after From date.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {valid && (
        <State {...records}>
          <p>{rows.length} GST records</p>
          {rows.length > 0 ? (
            <TripScroll>
              <table className="sheet-table gst-table">
                <thead>
                  <tr>
                    {gstColumns.map(([label, key]) => (
                      <th key={key}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.source + ":" + r._id}>
                      {gstColumns.map(([, key]) => (
                        <td key={key}>
                          {key === "billNumber" && r.invoiceId ? (
                            <Link to={"/invoices/" + r.invoiceId}>
                              {r.billNumber}
                            </Link>
                          ) : gstMoneyKeys.includes(key) ? (
                            currency(r[key])
                          ) : (
                            r[key]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    {gstColumns.map(([, key], index) => (
                      <td key={key}>
                        {index === 0
                          ? "TOTAL"
                          : gstMoneyKeys.includes(key)
                            ? currency(total(key))
                            : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </TripScroll>
          ) : (
            <p>No GST records in this date range.</p>
          )}
        </State>
      )}
    </>
  );
}
