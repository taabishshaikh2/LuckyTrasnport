import React, { useEffect, useState } from "react";
import { useData } from "../hooks/useData";
import { api, message } from "../api/client";
import { State, Field } from "../components/UI";
export default function ReminderSettings() {
  const records = useData("/reminders/settings"),
    [draft, setDraft] = useState({ enabled: false, recipients: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (records.data)
      setDraft({
        enabled: records.data.enabled,
        recipients: records.data.recipients.join(", "),
      });
  }, [records.data]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.put("/reminders/settings", {
        enabled: draft.enabled,
        recipients: draft.recipients
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setNotice("Reminder settings saved.");
      records.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Insurance & PUC email reminders</h2>
      <p>
        One email per document per day during the seven days before expiry.
        Updating the expiry date stops reminders for the old date. Dashboard
        alerts remain available when email is disabled.
      </p>
      <State {...records}>
        {records.data && (
          <form onSubmit={save}>
            {!records.data.emailConfigured && (
              <p>
                Email setup is required: add RESEND_API_KEY and
                REMINDER_EMAIL_FROM in your hosting environment.
              </p>
            )}
            <Field
              name="enabled"
              label="Enable daily expiry emails"
              type="checkbox"
              value={draft.enabled}
              onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
            />
            <Field
              name="recipients"
              label="Reminder email addresses (separate with commas)"
              type="textarea"
              value={draft.recipients}
              onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
            />
            {error && <p className="error">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <div className="actions">
              <button disabled={busy}>
                {busy ? "Saving..." : "Save reminder settings"}
              </button>
              <button
                type="button"
                className="quiet"
                disabled={busy}
                onClick={records.reload}
              >
                Refresh delivery status
              </button>
            </div>
            <p>
              Today's emails:{" "}
              {records.data.deliveries?.filter((d) => d.state === "Sent")
                .length || 0}{" "}
              accepted by the email service;{" "}
              {records.data.deliveries?.filter((d) => d.lastError).length || 0}{" "}
              awaiting retry.
            </p>
          </form>
        )}
      </State>
    </section>
  );
}
