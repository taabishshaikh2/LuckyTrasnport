import React, { useState } from "react";
import { useData } from "../hooks/useData";
import { download, message } from "../api/client";
import { State, Field, currency } from "../components/UI";
export function Reports() {
  const [filters, setFilters] = useState({
      from: "",
      to: "",
      customerId: "",
      vehicleId: "",
      routeId: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const customers = useData("/masters/customers"),
    vehicles = useData("/masters/vehicles"),
    routes = useData("/masters/routes"),
    balances = useData("/customer-balances");
  async function exportData() {
    setBusy(true);
    try {
      await download(
        "/exports/trips.xlsx?" +
          new URLSearchParams(Object.entries(filters).filter(([, v]) => v)),
        "lucky-trips.xlsx",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Reports & exports</h1>
      <section className="card">
        <h2>Trip sheet export</h2>
        <div className="form-grid">
          {[
            ["from", "From date", "date"],
            ["to", "To date", "date"],
          ].map(([name, label, type]) => (
            <Field
              key={name}
              name={name}
              label={label}
              type={type}
              value={filters[name]}
              onChange={(k, v) => setFilters((x) => ({ ...x, [k]: v }))}
            />
          ))}
          {[
            ["customerId", "Customer", customers, "companyName"],
            ["vehicleId", "Vehicle", vehicles, "vehicleNumber"],
            ["routeId", "Route", routes, "routeName"],
          ].map(([name, label, r, key]) => (
            <Field
              key={name}
              name={name}
              label={label}
              options={(r.data || []).map((x) => ({
                value: x._id,
                label: x[key],
              }))}
              value={filters[name]}
              onChange={(k, v) => setFilters((x) => ({ ...x, [k]: v }))}
            />
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <button disabled={busy} onClick={exportData}>
          Download Excel
        </button>
      </section>
      <h2>Customer outstanding</h2>
      <State {...balances}>
        {balances.data?.map((c) => (
          <section className="card" key={c.customerId}>
            <h3>{c.companyName}</h3>
            <div className="row">
              <span>
                Billed {currency(c.totalBilled)} · Received{" "}
                {currency(c.totalReceived)}
                <br />
                Opening balance {currency(c.openingBalance)}
              </span>
              <strong>{currency(c.outstanding)}</strong>
            </div>
          </section>
        ))}
      </State>
    </>
  );
}
export { default as Settings } from "./Settings";
