import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { api, message } from "../api/client";
import { Field, Calculation, today } from "../components/UI";
export const initialTrip = () => ({
  customerId: "",
  routeId: "",
  vehicleId: "",
  driverId: "",
  periodFrom: today(),
  periodTo: today(),
  distanceKm: 0,
  totalHours: 12,
  extraAmount: 0,
  deductionAmount: 0,
  status: "Draft",
  entries: [],
});
export function AssignmentFields({ value, onChange }) {
  const customers = useData("/masters/customers"),
    routes = useData("/masters/routes"),
    vehicles = useData("/masters/vehicles"),
    drivers = useData("/masters/drivers");
  return (
    <>
      <Field
        name="customerId"
        label="Customer"
        required
        options={(customers.data || []).map((c) => ({
          value: c._id,
          label: c.companyName,
        }))}
        value={value.customerId}
        onChange={onChange}
      />
      <Field
        name="routeId"
        label="Route"
        required
        options={(routes.data || [])
          .filter((r) => r.active)
          .map((c) => ({ value: c._id, label: c.routeName }))}
        value={value.routeId}
        onChange={onChange}
      />
      <Field
        name="vehicleId"
        label="Vehicle"
        required
        options={(vehicles.data || []).map((c) => ({
          value: c._id,
          label: c.vehicleNumber + " · " + c.vehicleType,
        }))}
        value={value.vehicleId}
        onChange={onChange}
      />
      <Field
        name="driverId"
        label="Driver"
        required
        options={(drivers.data || []).map((c) => ({
          value: c._id,
          label: c.fullName,
        }))}
        value={value.driverId}
        onChange={onChange}
      />
      {[customers, routes, vehicles, drivers].find((x) => x.error) && (
        <p className="error">
          Unable to load assignment options. Reload the page.
        </p>
      )}
    </>
  );
}
export function DutyFields({ value, onChange }) {
  return (
    <>
      {[
        ["periodFrom", "From", "date"],
        ["periodTo", "To", "date"],
        ["pickupLocation", "Pickup (required for Special)", "text"],
        ["dropLocation", "Drop (required for Special)", "text"],
        ["distanceKm", "Distance KM", "number"],
        ["totalHours", "Duty hours", "number"],
        ["extraAmount", "Other charges", "number"],
        ["deductionAmount", "Deductions", "number"],
        ["manualAmount", "Manually agreed amount", "number"],
        ["overrideAmount", "Override calculated rate", "number"],
        ["overrideReason", "Agreement / override reason", "textarea"],
        ["notes", "Notes", "textarea"],
      ].map(([name, label, type]) => (
        <Field
          key={name}
          name={name}
          label={label}
          type={type}
          value={value[name]}
          onChange={onChange}
        />
      ))}
    </>
  );
}
export default function TripForm({ existing, onClose }) {
  const nav = useNavigate(),
    [value, setValue] = useState(
      existing
        ? {
            ...existing,
            customerId: existing.customerId?._id,
            vehicleId: existing.vehicleId?._id,
            driverId: existing.driverId?._id,
            routeId: existing.routeId?._id,
            periodFrom: String(existing.periodFrom).slice(0, 10),
            periodTo: String(existing.periodTo).slice(0, 10),
          }
        : initialTrip(),
    ),
    [step, setStep] = useState(0),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (k, v) => {
    setValue((x) => ({ ...x, [k]: v }));
    setPreview(null);
  };
  const payload = () => {
    const p = { ...value };
    for (const k of ["manualAmount", "overrideAmount"])
      if (p[k] === "" || p[k] == null) delete p[k];
    return p;
  };
  async function review() {
    setBusy(true);
    setError("");
    try {
      setPreview((await api.post("/trips/preview", payload())).data.data);
      setStep(2);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(status) {
    setBusy(true);
    setError("");
    try {
      const url = "/trips" + (existing ? "/" + existing._id : "");
      const r = await api[existing ? "patch" : "post"](url, {
        ...payload(),
        status,
        expectedTotal: preview.calculation.totalAmount,
      });
      if (onClose) onClose();
      nav("/trips/" + r.data.data._id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-head">
        <h1>{existing ? "Edit draft" : "New trip"}</h1>
        {onClose && (
          <button className="quiet" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="steps">
        {["1 Assignment", "2 Duty & charges", "3 Review"].map((s, i) => (
          <span key={s} className={step === i ? "selected" : ""}>
            {s}
          </span>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="card form-grid">
        {step === 0 ? (
          <AssignmentFields value={value} onChange={change} />
        ) : step === 1 ? (
          <DutyFields value={value} onChange={change} />
        ) : (
          <>
            <Calculation value={preview} />
            <p>
              Confirm the route, rate and adjustments before saving. All totals
              are calculated by the server.
            </p>
          </>
        )}
      </div>
      <div className="actions sticky-actions">
        {step > 0 && (
          <button className="quiet" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step === 0 && <button onClick={() => setStep(1)}>Continue</button>}
        {step === 1 && (
          <button disabled={busy} onClick={review}>
            Calculate & review
          </button>
        )}
        {step === 2 && preview && (
          <>
            <button
              disabled={busy}
              className="quiet"
              onClick={() => save("Draft")}
            >
              Save draft
            </button>
            <button disabled={busy} onClick={() => save("Submitted")}>
              Submit trip
            </button>
          </>
        )}
      </div>
    </section>
  );
}
