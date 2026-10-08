import ShiftSettings from "../features/ShiftSettings";
import React, { useEffect, useState } from "react";
import { useData } from "../hooks/useData";
import { api, message } from "../api/client";
import { State, Field } from "../components/UI";
const sections = [
  {
    title: "Company details",
    fields: [
      ["name", "Company name"],
      ["tagline", "Tagline"],
      ["address", "Address", "textarea"],
      ["phone", "Phone", "tel"],
      ["email", "Email", "email"],
    ],
  },
  {
    title: "Tax information",
    fields: [
      ["gstin", "GSTIN"],
      ["pan", "PAN"],
      ["stateCode", "State code"],
    ],
  },
  {
    title: "Bank details",
    fields: [
      ["bankName", "Bank name"],
      ["bankAccount", "Account number"],
      ["bankIfsc", "IFSC"],
    ],
  },
  {
    title: "Invoice terms",
    fields: [
      ["disputeClause", "Dispute clause", "textarea"],
      ["interestClause", "Interest clause", "textarea"],
      ["paymentClause", "Payment clause", "textarea"],
    ],
  },
];
export default function Settings({ user }) {
  const r = useData("/settings");
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const canEdit = user.role === "ADMIN";
  useEffect(() => {
    if (r.data) setDraft(r.data);
  }, [r.data]);
  function change(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }
  async function save(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const result = (await api.patch("/settings", draft)).data.data;
      setDraft(result);
      setSuccess(
        "Company profile saved. These details will be used on new invoices.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Company profile</h1>
        </div>
      </div>
      <p className="muted">
        Company, tax and banking details for your invoices. Updating this
        profile preserves previously issued invoices.
      </p>
      {!canEdit && (
        <p className="notice">
          Only an administrator can edit the company profile.
        </p>
      )}
      <ShiftSettings user={user}/>
      <State {...r}>
        {draft && (
          <form onSubmit={save}>
            {sections.map((section) => (
              <section className="card" key={section.title}>
                <h2>{section.title}</h2>
                {canEdit ? (
                  <div className="form-grid">
                    {section.fields.map(([name, label, type = "text"]) => (
                      <Field
                        key={name}
                        name={name}
                        label={label}
                        type={type}
                        required={["name", "stateCode"].includes(name)}
                        value={draft[name]}
                        onChange={change}
                      />
                    ))}
                  </div>
                ) : (
                  <dl>
                    {section.fields.map(([name, label]) => (
                      <React.Fragment key={name}>
                        <dt>{label}</dt>
                        <dd>{draft[name] || "Not entered"}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </section>
            ))}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="success" role="status">
                {success}
              </p>
            )}
            {canEdit && (
              <div className="actions sticky-actions">
                <button disabled={busy}>
                  {busy ? "Savingâ€¦" : "Save company profile"}
                </button>
                <button
                  type="button"
                  className="quiet"
                  disabled={busy}
                  onClick={() => {
                    setDraft(r.data);
                    setError("");
                    setSuccess("");
                    r.reload();
                  }}
                >
                  Reload saved details
                </button>
              </div>
            )}
          </form>
        )}
      </State>
    </>
  );
}
