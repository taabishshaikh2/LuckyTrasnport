import React, { useState, useId } from "react";
export const currency = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
export const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const Badge = ({ children }) => (
  <span
    className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
  >
    {children}
  </span>
);
export function State({ loading, error, data, children }) {
  if (loading)
    return (
      <div className="state" role="status">
        Loading records…
      </div>
    );
  if (error)
    return (
      <div className="error" role="alert">
        {error}
      </div>
    );
  return children;
}
export function Field({
  name,
  label,
  type = "text",
  value,
  onChange,
  options,
  required = false,
}) {
  const [search, setSearch] = useState("");
  const inputId = useId();
  const selectable = options?.filter(
    (o) =>
      String(typeof o === "string" ? o : o.label)
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (typeof o === "string" ? o : o.value) === value,
  );
  return (
    <div className="field">
      <label htmlFor={inputId}>{label || name}</label>
      {options && options.some((o) => typeof o === "object") && (
        <input
          aria-label={"Search " + (label || name)}
          type="search"
          placeholder="Find an option…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {options ? (
        <select
          id={inputId}
          required={required}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
        >
          <option value="">Select…</option>
          {selectable.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === "checkbox" ? (
        <input
          id={inputId}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(name, e.target.checked)}
        />
      ) : type === "textarea" ? (
        <textarea
          id={inputId}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
        />
      ) : (
        <input
          id={inputId}
          required={required}
          type={type}
          min={type === "number" ? 0 : undefined}
          step={type === "number" ? "any" : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              name,
              type === "number" && e.target.value !== ""
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </div>
  );
}
export function Calculation({ value }) {
  if (!value) return null;
  const c = value.calculation || value,
    e = c.explanation;
  return (
    <section className="card calculation">
      <h3>Charge breakdown</h3>
      {e && (
        <p>
          {e.billingMethod} · {e.distanceKm} KM · Slab{" "}
          {e.minExclusive ? "above " : ""}
          {e.minKm}–{e.maxKm ?? "∞"} KM
          <br />
          Duty {e.totalHours} hours · Included {e.baseHours} hours
          <br />
          Base rate {currency(e.baseRate)} · Per KM {currency(e.perKmRate)} ·
          Per hour {currency(e.perHourRate)}
        </p>
      )}
      <dl>
        {[
          ["Base amount", c.baseAmount],
          [
            "Overtime (" +
              c.overtimeHours +
              " hrs × " +
              currency(c.overtimeRate) +
              ")",
            c.overtimeAmount,
          ],
          ["Final rate / agreed charge", c.finalRate ?? c.subtotal],
          ["Extra charges", c.extraAmount],
          ["Deductions", c.deductionAmount],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{currency(v)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="total">
        Total <strong>{currency(c.totalAmount)}</strong>
      </div>
    </section>
  );
}
