import React, { useState } from "react";
import BillingInvoiceForm, { Narration } from "../features/BillingInvoiceForm";
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
export function TaxSummary({ i }) {
  return (
    <section className="card">
      <h3>Invoice summary</h3>
      <dl>
        {[
          ["Taxable value", i.baseAmount],
          ["Other reimbursements", i.nonTaxableAmount || 0],
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
export function InvoiceForm() { return <BillingInvoiceForm />; }
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
  async function file(format, section="all") {
    try {
      await download(
        "/exports/invoices/" + id + "." + format + "?section=" + section,
        i.invoiceNumber.replaceAll("/", "-") + (section==="narration"?"-narration":"") + "." + format,
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
          {i.lineItems?.length > 0 && <Narration invoice={i} />}
          <section className="card row">
            <span>Received {currency(i.received)}</span>
            <strong>Outstanding {currency(i.outstanding)}</strong>
          </section>
          <div className="actions">
            <button onClick={() => file("pdf", ["Fixed","Variable"].includes(i.billingType)?"invoice":"all")}>Download invoice PDF</button>
            {["Fixed","Variable"].includes(i.billingType) && <><button onClick={() => file("pdf","narration")}>Print / download narration</button><button onClick={() => file("pdf")}>Invoice + narration PDF</button></>}
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
