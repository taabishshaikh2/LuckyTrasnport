import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "../hooks/useData";
import { api, message, download } from "../api/client";
import { State, Field, Badge, currency, date, today } from "../components/UI";
export function InvoiceList() {
  const r = useData("/invoices"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [month, setMonth] = useState("");
  return (
    <>
      <div className="page-head">
        <h1>Invoices</h1>
        <Link className="button" to="/invoices/new">
          + Invoice
        </Link>
      </div>
      <div className="filters">
        <input
          aria-label="Search invoices"
          placeholder="Invoice number or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Invoice status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["Pending", "Partially Paid", "Paid", "Overdue", "Cancelled"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <input
          type="month"
          aria-label="Invoice month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <State {...r}>
        <div className="card-grid">
          {r.data
            ?.filter(
              (i) =>
                JSON.stringify(i)
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (!status || i.status === status) &&
                (!month || i.invoiceDate.startsWith(month)),
            )
            .map((i) => (
              <Link
                className="card record"
                key={i._id}
                to={"/invoices/" + i._id}
              >
                <div className="row">
                  <span className="record-id">{i.invoiceNumber}</span>
                  <Badge>{i.status}</Badge>
                </div>
                <h3>{i.invoicedTo}</h3>
                <p>Due {date(i.dueDate)}</p>
                <div className="row">
                  <strong>{currency(i.totalAmount)}</strong>
                  <span>Outstanding {currency(i.outstanding)}</span>
                </div>
              </Link>
            ))}
        </div>
        {r.data?.length === 0 && (
          <div className="state">
            No invoices yet. Approve a trip to begin billing.
          </div>
        )}
      </State>
    </>
  );
}
function TaxSummary({ i }) {
  return (
    <section className="card">
      <h3>Invoice summary</h3>
      <dl>
        {[
          ["Taxable value", i.baseAmount],
          ["CGST " + i.cgstRate + "%", i.cgstAmount],
          ["SGST " + i.sgstRate + "%", i.sgstAmount],
          ["IGST " + i.igstRate + "%", i.igstAmount],
          ["Round off", i.roundOff],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{currency(v)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="total">
        Grand total <strong>{currency(i.totalAmount)}</strong>
      </div>
      <p>{i.amountInWords}</p>
    </section>
  );
}
export function InvoiceForm() {
  const nav = useNavigate(),
    customers = useData("/masters/customers"),
    trips = useData("/trips"),
    [value, setValue] = useState({
      customerId: "",
      tripIds: [],
      invoiceDate: today(),
      dueDate: today(),
      stateCode: "27",
      placeOfSupply: "Maharashtra",
      sacNo: "996601",
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      description: "",
      roundToRupee: true,
      taxConfirmed: false,
    }),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function change(k, v) {
    setValue((x) => ({
      ...x,
      [k]: v,
      ...(k === "customerId" ? { tripIds: [] } : {}),
    }));
    setPreview(null);
  }
  async function review(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setPreview((await api.post("/invoices/preview", value)).data.data);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const r = await api.post("/invoices", {
        ...value,
        expectedTotal: preview.totalAmount,
      });
      nav("/invoices/" + r.data.data._id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Create invoice</h1>
      <p className="muted">
        Select eligible trips and verify place of supply and GST rates before
        issuing.
      </p>
      {error && <p className="error">{error}</p>}
      <form onSubmit={review}>
        <section className="card form-grid">
          <Field
            name="customerId"
            label="Customer"
            required
            options={(customers.data || []).map((c) => ({
              value: c._id,
              label: c.companyName,
            }))}
            value={value.customerId}
            onChange={change}
          />
          {[
            ["invoiceDate", "Invoice date", "date"],
            ["dueDate", "Due date", "date"],
            ["stateCode", "Place of supply state code", "text"],
            ["placeOfSupply", "Place of supply", "text"],
            ["sacNo", "SAC", "text"],
            ["cgstRate", "CGST %", "number"],
            ["sgstRate", "SGST %", "number"],
            ["igstRate", "IGST %", "number"],
            ["description", "Description (blank = generated)", "textarea"],
            ["roundToRupee", "Round to rupee", "checkbox"],
            ["taxConfirmed", "I verified tax configuration", "checkbox"],
          ].map(([name, label, type]) => (
            <Field
              key={name}
              name={name}
              label={label}
              type={type}
              value={value[name]}
              onChange={change}
            />
          ))}
        </section>
        <h2>Eligible trips</h2>
        {trips.loading && <p>Loading trips…</p>}
        {(trips.error || customers.error) && (
          <p className="error">{trips.error || customers.error}</p>
        )}
        {trips.data
          ?.filter(
            (t) =>
              String(t.customerId?._id) === value.customerId &&
              ["Approved", "Completed"].includes(t.status),
          )
          .map((t) => (
            <label className="card check-row" key={t._id}>
              <input
                type="checkbox"
                checked={value.tripIds.includes(t._id)}
                onChange={(e) =>
                  change(
                    "tripIds",
                    e.target.checked
                      ? [...value.tripIds, t._id]
                      : value.tripIds.filter((id) => id !== t._id),
                  )
                }
              />
              <span>
                {t.tripId} · {t.pickupLocation} → {t.dropLocation}
              </span>
              <strong>{currency(t.totalAmount)}</strong>
            </label>
          ))}
        <button disabled={busy || !value.taxConfirmed || !value.tripIds.length}>
          Review invoice
        </button>
      </form>
      {preview && (
        <>
          <TaxSummary i={preview} />
          <section className="card">
            <h3>Description</h3>
            <p>{preview.description}</p>
          </section>
          <button disabled={busy} onClick={save}>
            Issue invoice
          </button>
        </>
      )}
    </>
  );
}
export function PaymentForm({ invoice, onSaved }) {
  const [value, setValue] = useState({
      invoiceId: invoice._id,
      paymentDate: today(),
      amount: invoice.outstanding,
      paymentMode: "Bank Transfer",
      referenceNumber: "",
      notes: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/payments", value);
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Record payment</h2>
      <p>Outstanding {currency(invoice.outstanding)}</p>
      <div className="form-grid">
        {[
          ["paymentDate", "Payment date", "date"],
          ["amount", "Amount", "number"],
          ["referenceNumber", "Reference", "text"],
          ["notes", "Notes", "textarea"],
        ].map(([name, label, type]) => (
          <Field
            key={name}
            name={name}
            label={label}
            type={type}
            value={value[name]}
            onChange={(k, v) => setValue((x) => ({ ...x, [k]: v }))}
          />
        ))}
        <Field
          name="paymentMode"
          label="Mode"
          options={["Cash", "Bank Transfer", "UPI", "Cheque", "Other"]}
          value={value.paymentMode}
          onChange={(k, v) => setValue((x) => ({ ...x, [k]: v }))}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>Save payment</button>
    </form>
  );
}
export function InvoiceDetail() {
  const { id } = useParams(),
    r = useData("/invoices/" + id),
    [pay, setPay] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState("");
  const i = r.data;
  async function file(format) {
    try {
      await download(
        "/exports/invoices/" + id + "." + format,
        i.invoiceNumber.replaceAll("/", "-") + "." + format,
      );
    } catch (e) {
      setError(message(e));
    }
  }
  async function cancel() {
    try {
      await api.post("/invoices/" + id + "/cancel", { reason });
      r.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <State {...r}>
      {i && (
        <>
          <div className="page-head">
            <h1>{i.invoiceNumber}</h1>
            <Badge>{i.status}</Badge>
          </div>
          {error && <p className="error">{error}</p>}
          <section className="card">
            <h2>{i.invoicedTo}</h2>
            <p>{i.billingAddress}</p>
            <p>
              Invoice {date(i.invoiceDate)} · Due {date(i.dueDate)}
            </p>
            <p>{i.description}</p>
            <p>
              SAC {i.sacNo} · Place of supply {i.placeOfSupply} ({i.stateCode})
            </p>
          </section>
          <TaxSummary i={i} />
          <section className="card row">
            <span>Received {currency(i.received)}</span>
            <strong>Outstanding {currency(i.outstanding)}</strong>
          </section>
          <div className="actions">
            <button onClick={() => file("pdf")}>Download PDF</button>
            <button className="quiet" onClick={() => file("docx")}>
              DOCX
            </button>
            <button
              className="quiet"
              onClick={async () => {
                try {
                  await download(
                    "/exports/trips.xlsx?invoiceId=" + id,
                    "invoice-trip-sheet.xlsx",
                  );
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              Supporting Excel
            </button>
            {i.outstanding > 0 && i.status !== "Cancelled" && (
              <button onClick={() => setPay(!pay)}>Record payment</button>
            )}
          </div>
          {pay && (
            <PaymentForm
              invoice={i}
              onSaved={() => {
                setPay(false);
                r.reload();
              }}
            />
          )}
          <h2>Payment history</h2>
          {i.payments.length === 0 ? (
            <p className="muted">No payments recorded.</p>
          ) : (
            i.payments.map((p) => (
              <section key={p._id} className="card row">
                <span>
                  {p.paymentId} · {date(p.paymentDate)} · {p.paymentMode}
                  <br />
                  {p.referenceNumber}
                </span>
                <strong>{currency(p.amount)}</strong>
              </section>
            ))
          )}
          {i.status !== "Cancelled" && i.received === 0 && (
            <section className="card">
              <Field
                name="reason"
                label="Cancellation reason"
                value={reason}
                onChange={(_, v) => setReason(v)}
              />
              <button
                className="danger"
                disabled={reason.trim().length < 3}
                onClick={cancel}
              >
                Cancel invoice
              </button>
            </section>
          )}
        </>
      )}
    </State>
  );
}
export function Payments() {
  const payments = useData("/payments"),
    invoices = useData("/invoices"),
    [selected, setSelected] = useState("");
  const invoice = invoices.data?.find((i) => i._id === selected);
  return (
    <>
      <h1>Payments</h1>
      <section className="card">
        <Field
          name="invoice"
          label="Record payment against invoice"
          value={selected}
          options={(invoices.data || [])
            .filter((i) => i.outstanding > 0 && i.status !== "Cancelled")
            .map((i) => ({
              value: i._id,
              label:
                i.invoiceNumber +
                " · " +
                i.invoicedTo +
                " · " +
                currency(i.outstanding),
            }))}
          onChange={(_, v) => setSelected(v)}
        />
      </section>
      {invoice && (
        <PaymentForm
          key={invoice._id}
          invoice={invoice}
          onSaved={() => {
            setSelected("");
            invoices.reload();
            payments.reload();
          }}
        />
      )}
      <State {...payments}>
        {payments.data?.map((p) => (
          <section className="card row" key={p._id}>
            <span>
              <strong>{p.paymentId}</strong>
              <br />
              {p.invoiceId?.invoiceNumber} · {p.customerId?.companyName}
              <br />
              {date(p.paymentDate)} · {p.paymentMode}
            </span>
            <strong>{currency(p.amount)}</strong>
          </section>
        ))}
        {payments.data?.length === 0 && (
          <div className="state">No payments recorded.</div>
        )}
      </State>
    </>
  );
}
