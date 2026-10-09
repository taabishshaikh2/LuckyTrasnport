import React, { useState } from "react";

import { useNavigate } from "react-router-dom";

import { useData } from "../hooks/useData";

import { api, message } from "../api/client";

import { Field, Calculation, today } from "../components/UI";

import { SheetFields } from "./SheetFields";

import { sites } from "../../../shared/sites.js";

export const initialTrip = () => ({

  site: "Inbound", dutyKind:"Adhoc", pickupLocation:"MIDC",dropLocation:"Cargo",

  customerId: "",

  routeId: "",

  vehicleId: "",

  driverId: "",

  periodFrom: today(),

  periodTo: today(),

  distanceKm: 0,

  totalHours: 0,

  extraAmount: 0,

  deductionAmount: 0,

  status: "Draft",

  entries: [],

});

export function AssignmentFields({ value, onChange, importing = false }) {

  const customers = useData("/masters/customers"),

    routes = useData("/masters/routes"),

    vehicles = useData("/masters/vehicles"),

    drivers = useData("/masters/drivers"),

    agreements = useData("/masters/agreements");

  return (

    <>

      {value.dutyKind!=="Branded" && <Field name="site" label="Site" required options={sites} value={value.site} onChange={(k,v)=>{

        const selected=sites.find(s=>s.value===v);

        onChange(k,v);onChange("pickupLocation",selected?.origin || "");onChange("dropLocation",selected?.destination || "");

      }} />} 

      <Field name="dutyKind" label="Duty type" options={value.dutyKind==="Branded"?["Branded"]:["Adhoc"]} value={value.dutyKind} onChange={onChange} />

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

        label={

          importing

            ? "Fallback vehicle (when sheet has no vehicle number)"

            : "Vehicle"

        }

        required={!importing}

        options={(vehicles.data || []).map((c) => ({

          value: c._id,

          label: c.vehicleNumber + " · " + c.vehicleType,

        }))}

        value={value.vehicleId}

        onChange={onChange}

      />

      {value.dutyKind === "Branded" && <p>Assigned shift: {(agreements.data || []).find(a=>a.vehicleId===value.vehicleId && a.customerId===value.customerId && a.site===value.site && a.active)?.shiftHours || "Select vehicle shift first"} hours. Monthly extra services are calculated automatically when invoicing.</p>}

      <Field

        name="driverId"

        label="Driver (optional for drafts)"

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

      ].filter(([name])=>value.dutyKind!=="Branded" || !["extraAmount","deductionAmount","manualAmount","overrideAmount","overrideReason"].includes(name)).map(([name, label, type]) => (

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

            driverId: existing.driverId?._id || "",

            routeId: existing.routeId?._id,

            entries: existing.entries.map((e) => ({

              ...e,

              date: String(e.date).slice(0, 10),

            })),

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

  async function review(event) {

    const inputs=event.currentTarget.closest("section").querySelectorAll("input");

    for (const input of inputs) if (!input.reportValidity()) return;

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

          <>

            <DutyFields value={value} onChange={change} />

            <h2>Trip-sheet columns</h2>

            <p>

              Opening time is pickup arrival. With opening and closing times,

              duty hours are calculated automatically. Use a closing date for

              overnight or multi-day duty. One challan is one trip; supporting daily records stay together.

              Trip charges and overtime are calculated from the saved rate chart. Enter each toll or parking expense once, here or on the separate expenses page.

            </p>

            {(value.entries.length ? value.entries : [{date:value.periodFrom}]).map((entry,index)=><section className="card form-grid" key={index}>

              <Field name="date" label="Duty record date" type="date" value={entry.date || value.periodFrom} onChange={(k,v)=>change("entries",(value.entries.length?value.entries:[entry]).map((e,i)=>i===index?{...e,[k]:v}:e))}/>

              <SheetFields entry={entry} onChange={(k,v)=>change("entries",(value.entries.length?value.entries:[entry]).map((e,i)=>i===index?{...e,date:e.date || value.periodFrom,[k]:v}:e))}/>

              {index>0 && <button className="quiet" onClick={()=>change("entries",value.entries.filter((_,i)=>i!==index))}>Remove daily record</button>}

            </section>)}

            <button className="quiet" onClick={()=>change("entries",[

              ...(value.entries.length?value.entries:[{date:value.periodFrom}]),

              {date:value.periodTo,challanNumber:value.entries[0]?.challanNumber || ""},

            ])}>+ Daily continuation for this challan</button>



          </>

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

