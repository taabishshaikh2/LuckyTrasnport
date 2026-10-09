import BrandedImport from "../features/BrandedImport";
import {logAdcAmounts} from "../../../shared/brandedLogs.js";
import {download} from "../api/client";
import React, { useState, useEffect } from "react";

import { useSearchParams } from "react-router-dom";

import { useData } from "../hooks/useData";

import { api, message } from "../api/client";

import { config } from "../features/masterConfig";

import { State, Field, Badge } from "../components/UI";

export default function Masters({ entity, user }) {

  const [logMonth,setLogMonth]=useState(new Date().toISOString().slice(0,7)),[logVehicle,setLogVehicle]=useState("");
  const [params, setParams] = useSearchParams();

  const cfg = config[entity],

    records = useData("/masters/" + entity + (entity==="brandedLogs"?"?month="+logMonth:"")),

    vehicles = useData("/masters/vehicles"),

    routes = useData("/masters/routes"),

    drivers = useData("/masters/drivers"),

    customers = useData("/masters/customers"),

    fleetRates = useData("/masters/fleetRates"), shifts = useData("/settings/shifts");


  const offDates=useData("/masters/weeklyOffs?month="+logMonth);
  const adcAmounts=new Map();
  for(const v of vehicles.data||[]){const rows=(records.data||[]).filter(l=>l.vehicleId===v._id && String(l.date).slice(0,7)===logMonth);for(const customerId of new Set(rows.map(l=>l.customerId))){const selected=rows.filter(l=>l.customerId===customerId);const offs=(offDates.data||[]).filter(o=>o.vehicleId===v._id && o.customerId===customerId && String(o.date).slice(0,7)===logMonth);for(const [id,amount] of logAdcAmounts(selected,v.shiftHours,v.adcRate||0,offs.length||undefined))adcAmounts.set(id,amount);}}
  const [search, setSearch] = useState(""),

    [filter, setFilter] = useState(""),

    [edit, setEdit] = useState(params.has("new") ? { ...cfg.defaults,...(["fleetRates","fleetManagers","fuelCharges","vehicleExpenses","airportExpenses"].includes(entity)?{site:"Branded"}:{}) } : null),

    [detail, setDetail] = useState(null),

    [error, setError] = useState(""),

    [busy, setBusy] = useState(false),

    [success, setSuccess] = useState("");

  const canEdit =

    !["rates", "routes", "users", "agreements", "fleetRates", "tripRates", "fleetManagers"].includes(entity) || user.role === "ADMIN";

  useEffect(() => {

    if (params.has("new")) {

      setEdit({ ...cfg.defaults,...(["fleetRates","fleetManagers","fuelCharges","vehicleExpenses","airportExpenses"].includes(entity)?{site:"Branded"}:{}) });

      setParams({}, { replace: true });

    }

  }, [params.toString()]);

  const change = (k, v) => setEdit((x) => ({ ...x, [k]: v,

    ...(entity === "agreements" && ["customerId","site","vehicleId","shiftHours"].includes(k) ? {fleetRateId:""} : {}) }));

  async function save(e) {

    e.preventDefault();

    setBusy(true);

    setError("");

    try {

      const payload = { ...edit,...(entity==="vehicles"?{tollEntryMonthly:0}:{}) };

      for (const f of cfg.fields)

        if (f.type === "date" && payload[f.name])

          payload[f.name] = String(payload[f.name]).slice(0, 10);

      if (entity === "agreements" && !payload.fleetRateId) throw new Error("Select a rate chart before saving this shift");

      if (entity === "rates" && payload.maxKm === "") payload.maxKm = null;

      if (entity === "users" && !payload.password) delete payload.password;

      await api[edit._id ? "patch" : "post"](

        "/masters/" + entity + (edit._id ? "/" + edit._id : ""),

        payload,

      );

      setEdit(null);

      records.reload();

      setSuccess("Record saved");

    } catch (e) {

      setError(message(e));

    } finally {

      setBusy(false);

    }

  }

  async function archive() {

    setBusy(true);

    setError("");

    try {

      await api.delete("/masters/" + entity + "/" + detail._id);

      setDetail(null);

      records.reload();

      setSuccess("Record archived; historical records retained");

    } catch (e) {

      setError(message(e));

    } finally {

      setBusy(false);

    }

  }

  const optionsFor = (name) =>
    name === "shiftHours" ? shifts.data?.entries.map(s=>({value:String(s.hours),label:s.hours+" hours - "+s.monthlyKm+" KM"})) :

    name === "vehicleType" && entity === "tripRates" ? [...new Set((vehicles.data || []).map(v=>v.vehicleType === "Custom" ? v.customVehicleType || "Custom" : v.vehicleType))] :

    name === "vehicleType" && entity === "fleetRates" ? [...new Set((vehicles.data || []).map(v=>v.vehicleType))] :

    name === "fleetRateId" ? fleetRates.data?.filter(r=>r.active && r.customerId===edit?.customerId && r.site===edit?.site && Number(r.shiftHours)===Number(edit?.shiftHours) && r.vehicleType===vehicles.data?.find(v=>v._id===edit?.vehicleId)?.vehicleType).map(r=>({value:r._id,label:r.name})) :

    name === "assignedVehicleId" || name === "vehicleId"

      ? vehicles.data?.filter(v=>!["brandedLogs","weeklyOffs"].includes(entity) || v.branded).map((v) => ({ value: v._id, label: v.vehicleNumber+"  /  "+v.vehicleType }))

      : name === "customerId" ? customers.data?.map(v=>({value:v._id,label:v.companyName}))

      : name === "routeId"

        ? routes.data?.map((v) => ({ value: v._id, label: v.routeName }))

        : name === "driverId"

          ? drivers.data?.map((v) => ({ value: v._id, label: v.fullName }))

          : undefined;

  return (

    <>

      <div className="page-head">

        <div>

          <p className="eyebrow">YOUR BUSINESS</p>

          <h1>{cfg.title}</h1>

        </div>

        {canEdit && (

          <button

            onClick={() => {

              setEdit({ ...cfg.defaults,...(["fleetRates","fleetManagers","fuelCharges","vehicleExpenses","airportExpenses"].includes(entity)?{site:"Branded"}:{}) });

              setError("");

            }}

          >

            + Add

          </button>

        )}

      </div>

      {entity === "weeklyOffs" && <p>Without off dates, billing allows one weekly off per seven days (four in a full month). When off dates are logged, billing uses those dates. Each off removes the vehicle's assigned 8/16/24 duty hours from included hours.</p>}
      {entity === "brandedLogs" && <p>One row = one 8-hour shift. Total KM = closing minus opening. Loaded / held rows have zero KM. ADC is calculated from the monthly excess duty hours; airport entry fees remain outside GST.</p>}
      {entity === "tripRates" && <p>For Adhoc trips only. Save once per vehicle type. Trips automatically use the distance band and additional-hour cost. Above 150 KM, the per-KM rate applies to the whole trip distance. Overtime uses exact minutes beyond the trip's included hours.</p>}

      {entity === "agreements" && <p>Select the vehicle and rate chart. Included monthly KM: 8 hours = 3,000; 16 = 4,000; 24 = 5,000. Fuel and expenses have their own pages.</p>}

      {entity === "fleetRates" && <p>Rates apply by vehicle type, site and assigned shift. Additional services are charged per 8-hour shift, including exact fractions of a shift.</p>}

      {entity === "fuelCharges" && <p>Select the vehicle and billing period, then enter its mileage and fuel rate. Actual KM comes from approved trip records.</p>}

      {entity === "vehicleExpenses" && <p>Record each charge once here. These charges are added to the variable invoice for the selected vehicle and dates.</p>}

      {entity === "airportExpenses" && <p>Airport entry fees are reimbursed after GST. GST is never applied to these records.</p>}

      {success && (

        <p className="success" role="status">

          {success}

        </p>

      )}

      {error && (

        <p className="error" role="alert">

          {error}

        </p>

      )}

      <div className="filters">

        <input

          aria-label="Search records"

          placeholder="Search records..."

          value={search}

          onChange={(e) => setSearch(e.target.value)}

        />

        <select

          aria-label="Filter status"

          value={filter}

          onChange={(e) => setFilter(e.target.value)}

        >

          <option value="">All statuses</option>

          {[

            ...new Set(

              records.data?.map((x) => x.status || (x.active == null ? "Recorded" : String(x.active))) || [],

            ),

          ].map((s) => (

            <option key={s}>{s}</option>

          ))}

        </select>

      </div>

      {entity==="brandedLogs" && <div className="filters"><input aria-label="Log month" type="month" value={logMonth} onChange={e=>setLogMonth(e.target.value)}/><select aria-label="Branded vehicle" value={logVehicle} onChange={e=>setLogVehicle(e.target.value)}><option value="">All branded vehicles</option>{vehicles.data?.filter(v=>v.branded).map(v=><option key={v._id} value={v._id}>{v.vehicleNumber}</option>)}</select><button onClick={async()=>{try{await download("/exports/branded-logs.xlsx?month="+logMonth+(logVehicle?"&vehicleId="+logVehicle:""),"branded-shift-log.xlsx");}catch(e){setError(message(e));}}}>Export branded log Excel</button><BrandedImport customers={customers.data||[]} onImported={count=>{records.reload();setSuccess(count+" branded shifts imported");}}/></div>}
      <State {...records}>

        {entity === "tripRates" && <div className="sheet-scroll"><table className="trip-sheet"><thead><tr><th>Vehicle type</th><th>0-50 KM</th><th>Above 50-150 KM</th><th>Above 150 KM / KM</th><th>Additional hour cost</th><th>Status</th></tr></thead><tbody>{records.data?.filter(x=>JSON.stringify({...x,customerName:customers.data?.find(c=>c._id===String(x.customerId))?.companyName}).toLowerCase().includes(search.toLowerCase()) && (!filter || String(x.active)===filter)).map(x=><tr key={x._id}><td><button className="quiet" onClick={()=>setDetail(x)}>{x.vehicleType}</button></td>{["upTo50","upTo150","above150","overtimeRate"].map(k=><td key={k}>{Number(x[k]).toFixed(2)}</td>)}<td>{x.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}

        {entity === "brandedLogs" && <div className="sheet-scroll"><table className="trip-sheet"><thead><tr>{["Date","Vehicle no.","Opening KM","Closing KM","Total KM","Opening time","Closing time","Total hours","Additional service charges","Domestic airport entry"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{records.data?.filter(x=>String(x.date).slice(0,7)===logMonth && (!logVehicle || x.vehicleId===logVehicle) && JSON.stringify(x).toLowerCase().includes(search.toLowerCase())).map(x=><tr key={x._id}><td><button className="quiet" onClick={()=>setDetail(x)}>{String(x.date).slice(0,10)}</button></td><td>{vehicles.data?.find(v=>v._id===x.vehicleId)?.vehicleNumber}</td><td>{x.held?"Loaded / held: "+x.holdLocation:x.openingKm}</td><td>{x.held?x.holdLocation:x.closingKm}</td><td>{x.distanceKm}</td><td>{x.openingTime}</td><td>{x.closingTime}</td><td>{x.totalHours}</td><td>{Number(adcAmounts.get(x._id)||0).toFixed(2)}</td><td>{Number(x.airportFee||0).toFixed(2)}</td></tr>)}</tbody></table></div>}
        <div className="card-grid" style={["tripRates","brandedLogs"].includes(entity) ? {display:"none"} : undefined}>

          {records.data

            ?.filter(

              (x) =>

                JSON.stringify({...x,customerName:customers.data?.find(c=>c._id===String(x.customerId))?.companyName})

                  .toLowerCase()

                  .includes(search.toLowerCase()) &&

                (!filter || (x.status || (x.active == null ? "Recorded" : String(x.active))) === filter),

            )

            .map((x) => (

              <button

                className="record card"

                key={x._id}

                onClick={() => {

                  setDetail(x);

                  setError("");

                }}

              >

                <span className="record-id">{x[cfg.id]}</span>

                <h3>{x[cfg.label]}</h3>

                <p>

                  {entity === "rates"

                    ? x.billingMethod +

                      "  /  " +

                      x.minKm +

                      "-" +

                      (x.maxKm ?? "unlimited") +

                      " KM"

                    : x.phone ||

                      x.vehicleType ||

                      x.pickupLocation ||

                      x.role ||

                      x.city}

                </p>

                <Badge>{x.status || (x.active == null ? "Recorded" : x.active ? "Active" : "Inactive")}</Badge>

              </button>

            ))}

        </div>

        {records.data?.length === 0 && (

          <div className="state">

            No records yet. Add your first {entity.slice(0, -1)}.

          </div>

        )}

      </State>

      {detail && (

        <div className="modal-backdrop">

          <section className="modal">

            <div className="page-head">

              <h2>{detail[cfg.label]}</h2>

              <button className="quiet" onClick={() => setDetail(null)}>

                Close

              </button>

            </div>

            <dl>

              {cfg.fields

                .filter((f) => f.name !== "password")

                .map((f) => (

                  <React.Fragment key={f.name}>

                    <dt>{f.label}</dt>

                    <dd>

                      {f.type === "date"

                        ? String(detail[f.name] || "").slice(0, 10)

                        : String(entity==="vehicles" && f.name==="parkingMonthly" ? Number(detail.parkingMonthly||0)+Number(detail.tollEntryMonthly||0) : f.name==="customerId" ? (customers.data?.find(c=>c._id===String(detail[f.name]))?.companyName || "Customer unavailable") : (optionsFor(f.name) || f.options)?.find(o=>typeof o!=="string" && String(o.value)===String(detail[f.name]))?.label ?? detail[f.name] ?? "-")}

                    </dd>

                  </React.Fragment>

                ))}

            </dl>

            {canEdit && (

              <div className="actions">

                <button

                  onClick={() => {

                    setEdit({ ...detail,...(entity==="vehicles"?{parkingMonthly:Number(detail.parkingMonthly||0)+Number(detail.tollEntryMonthly||0),tollEntryMonthly:0}:{}) });

                    setDetail(null);

                  }}

                >

                  Edit record

                </button>

                {entity !== "users" && (

                  <button disabled={busy} className="danger" onClick={archive}>

                    Archive

                  </button>

                )}

              </div>

            )}

          </section>

        </div>

      )}

      {edit && (

        <div className="modal-backdrop">

          <form className="modal" onSubmit={save}>

            <div className="page-head">

              <h2>

                {edit._id ? "Edit" : "Add"}  /  {cfg.title}

              </h2>

              <button

                type="button"

                className="quiet"

                onClick={() => setEdit(null)}

              >

                Close

              </button>

            </div>

            <div className="form-grid">

              {cfg.fields.filter(f=>!(f.name==="site" && ["fleetRates","fleetManagers","fuelCharges","vehicleExpenses","airportExpenses"].includes(entity))).filter(f=>entity!=="vehicles" || edit?.branded || !["adcRate","amcRate","parkingMonthly","tollEntryMonthly"].includes(f.name)).map((f) => (

                <Field

                  key={f.name}

                  {...f}

                  required={[

                    "vehicleId", "customerId", "site", "fleetRateId", "periodFrom", "periodTo", "effectiveFrom", "date",

                    "vehicleNumber",

                    "vehicleType",

                    "fullName",

                    "companyName",

                    "routeName",

                    "pickupLocation",

                    "dropLocation",

                    "username",

                    "name",

                    "stateCode",

                  ].includes(f.name)}

                  options={optionsFor(f.name) || f.options}

                  value={

                    f.type === "date"

                      ? String(edit[f.name] || "").slice(0, 10)

                      : edit[f.name]

                  }

                  onChange={change}

                />

              ))}

            </div>

            {error && <p className="error">{error}</p>}

            <button className="wide" disabled={busy}>

              {busy ? "Saving..." : "Save record"}

            </button>

          </form>

        </div>

      )}

    </>

  );

}

