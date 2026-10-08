import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useData } from "../hooks/useData";
import { api, message } from "../api/client";
import { config } from "../features/masterConfig";
import { State, Field, Badge } from "../components/UI";
export default function Masters({ entity, user }) {
  const [params, setParams] = useSearchParams();
  const cfg = config[entity],
    records = useData("/masters/" + entity),
    vehicles = useData("/masters/vehicles"),
    routes = useData("/masters/routes"),
    drivers = useData("/masters/drivers"),
    customers = useData("/masters/customers"),
    fleetRates = useData("/masters/fleetRates");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [edit, setEdit] = useState(params.has("new") ? { ...cfg.defaults } : null),
    [detail, setDetail] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const canEdit =
    !["rates", "routes", "users", "agreements", "fleetRates"].includes(entity) || user.role === "ADMIN";
  useEffect(() => {
    if (params.has("new")) {
      setEdit({ ...cfg.defaults });
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
      const payload = { ...edit };
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
    name === "vehicleType" && entity === "fleetRates" ? [...new Set((vehicles.data || []).map(v=>v.vehicleType))] :
    name === "fleetRateId" ? fleetRates.data?.filter(r=>r.active && r.customerId===edit?.customerId && r.site===edit?.site && Number(r.shiftHours)===Number(edit?.shiftHours) && r.vehicleType===vehicles.data?.find(v=>v._id===edit?.vehicleId)?.vehicleType).map(r=>({value:r._id,label:r.name})) :
    name === "assignedVehicleId" || name === "vehicleId"
      ? vehicles.data?.map((v) => ({ value: v._id, label: v.vehicleNumber+" · "+v.vehicleType }))
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
              setEdit({ ...cfg.defaults });
              setError("");
            }}
          >
            + Add
          </button>
        )}
      </div>
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
          placeholder="Search records…"
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
      <State {...records}>
        <div className="card-grid">
          {records.data
            ?.filter(
              (x) =>
                JSON.stringify(x)
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
                      " · " +
                      x.minKm +
                      "–" +
                      (x.maxKm ?? "∞") +
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
                        : String(detail[f.name] ?? "—")}
                    </dd>
                  </React.Fragment>
                ))}
            </dl>
            {canEdit && (
              <div className="actions">
                <button
                  onClick={() => {
                    setEdit({ ...detail });
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
                {edit._id ? "Edit" : "Add"} · {cfg.title}
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
              {cfg.fields.map((f) => (
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
              {busy ? "Saving…" : "Save record"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
